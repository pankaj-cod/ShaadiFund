import { describe, expect, it } from "vitest";
import { waitlistInputSchema } from "./waitlist.schema";

const valid = { email: "  Meera@Example.COM ", role: "COUPLE", consent: true };

describe("waitlist input", () => {
  it("normalises the email and fills in the source", () => {
    expect(waitlistInputSchema.parse(valid)).toMatchObject({
      email: "meera@example.com",
      role: "COUPLE",
      source: "home",
    });
  });

  it("drops empty optional fields", () => {
    const parsed = waitlistInputSchema.parse({ ...valid, name: "  ", city: "", weddingMonth: "" });
    expect(parsed.name).toBeUndefined();
    expect(parsed.city).toBeUndefined();
    expect(parsed.weddingMonth).toBeUndefined();
  });

  it("keeps a wedding month only for couples", () => {
    expect(waitlistInputSchema.parse({ ...valid, weddingMonth: "2027-02" }).weddingMonth).toBe(
      "2027-02",
    );
    expect(
      waitlistInputSchema.parse({ ...valid, role: "GUEST", weddingMonth: "2027-02" }).weddingMonth,
    ).toBeUndefined();
  });

  it("accepts a tidy campaign tag and ignores anything else", () => {
    expect(waitlistInputSchema.parse({ ...valid, source: "Instagram_Feb" }).source).toBe(
      "instagram_feb",
    );
    expect(waitlistInputSchema.parse({ ...valid, source: "<script>" }).source).toBe("home");
    expect(waitlistInputSchema.parse({ ...valid, source: "x".repeat(41) }).source).toBe("home");
  });

  it.each([
    ["a missing consent", { consent: false }],
    ["a bad email", { email: "not-an-email" }],
    ["an unknown role", { role: "BRIDE" }],
    ["a malformed month", { weddingMonth: "2027-13" }],
    ["an over-long name", { name: "x".repeat(81) }],
  ])("rejects %s", (_label, overrides) => {
    expect(waitlistInputSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });
});

describe("email fields across the site", () => {
  it("accept an address with stray spaces and capitals, as phone keyboards produce", async () => {
    const { contributionInputSchema } = await import("@/modules/contribution/contribution.schema");
    const parsed = contributionInputSchema.safeParse({
      dreamId: "01a1df73-6f2a-71a9-84c5-165560c5d7c4",
      amountRupees: 1100,
      guestName: "Ananya",
      guestEmail: " Ananya@Example.com ",
      isAnonymous: false,
      message: "",
      messageVisibility: "PUBLIC",
      consent: true,
      idempotencyKey: "01a1df73-6f2a-71a9-84c5-165560c5d7c5",
    });
    expect(parsed.success && parsed.data.guestEmail).toBe("ananya@example.com");
  });
});
