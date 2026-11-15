import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { NotFoundError, ValidationError } from "./errors";
import { ok, route, toErrorResponse } from "./http";
import { redact } from "./logger";

describe("http envelope", () => {
  it("wraps success in data", async () => {
    expect(await ok({ a: 1 }).json()).toEqual({ data: { a: 1 } });
  });

  it("maps an AppError to its status and code", async () => {
    const response = toErrorResponse(new NotFoundError());
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("carries field messages for validation errors", async () => {
    const response = toErrorResponse(new ValidationError(undefined, { amountPaise: "Too low" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({ amountPaise: "Too low" });
  });

  it("maps a ZodError to per-field messages", async () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    const response = toErrorResponse(parsed.error);
    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).error.fields)).toEqual(["name"]);
  });

  it("hides the details of unexpected errors but logs them", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = route(async () => {
      throw new Error("database password is hunter2");
    });
    const response = await handler(new Request("http://localhost/api/x"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("log redaction", () => {
  it("redacts sensitive keys at any depth", () => {
    const out = redact({ guest: { email: "a@b.c", name: "A" }, signature: "abc", amount: 5 });
    expect(out).toEqual({
      guest: { email: "[redacted]", name: "A" },
      signature: "[redacted]",
      amount: 5,
    });
  });
});
