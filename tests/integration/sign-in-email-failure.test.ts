import { afterAll, describe, expect, it, vi } from "vitest";
import { createTestDb, hasDatabase } from "../support/db";

/**
 * Drives the real sign-in endpoint with email delivery switched to Resend and
 * Resend refusing (as it does for an unverified sending domain). The visitor
 * must get a 503 with our code, not a generic failure.
 */
describe.skipIf(!hasDatabase)("sign-in when the email service refuses", () => {
  const db = createTestDb();
  const email = `refused-${crypto.randomUUID().slice(0, 8)}@signin.shaadifund.test`;

  afterAll(async () => {
    await db.verification.deleteMany({
      where: { identifier: { contains: "signin.shaadifund.test" } },
    });
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  async function post(path: string, body: unknown) {
    vi.resetModules();
    process.env.EMAIL_TRANSPORT = "resend";
    process.env.RESEND_API_KEY = "re_test_placeholder";
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://api.resend.com/")) {
        return Response.json(
          { name: "validation_error", message: "The shaadifund.test domain is not verified." },
          { status: 403 },
        );
      }
      return realFetch(input, init);
    });
    try {
      const { getAuth } = await import("@/modules/auth/auth");
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      return await getAuth().handler(
        new Request(`${appUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: appUrl },
          body: JSON.stringify(body),
        }),
      );
    } finally {
      process.env.EMAIL_TRANSPORT = "file";
      delete process.env.RESEND_API_KEY;
    }
  }

  it("answers 503 EMAIL_NOT_SENT and logs Resend's reason", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post("/api/auth/sign-in/magic-link", {
      email,
      callbackURL: "/dashboard",
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EMAIL_NOT_SENT" });
    expect(logged.mock.calls.flat().join(" ")).toContain("domain is not verified");
    logged.mockRestore();
  });
});
