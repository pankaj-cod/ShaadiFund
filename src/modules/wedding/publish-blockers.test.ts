import { describe, expect, it } from "vitest";
import { assertWithinRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { RateLimitedError } from "@/lib/errors";
import { publishBlockers } from "./wedding.service";

describe("publishBlockers", () => {
  it("is empty when both names and an active dream exist", () => {
    expect(
      publishBlockers({ partnerOneName: "Riya", partnerTwoName: "Rahul", activeDreamCount: 1 }),
    ).toEqual([]);
  });

  it("asks for names when either is missing or blank", () => {
    expect(
      publishBlockers({ partnerOneName: "Riya", partnerTwoName: "  ", activeDreamCount: 1 }),
    ).toHaveLength(1);
    expect(
      publishBlockers({ partnerOneName: null, partnerTwoName: "Rahul", activeDreamCount: 1 }),
    ).toHaveLength(1);
  });

  it("asks for a dream when none is active", () => {
    expect(
      publishBlockers({ partnerOneName: "Riya", partnerTwoName: "Rahul", activeDreamCount: 0 }),
    ).toEqual(["Add at least one dream that is open for contributions."]);
  });
});

describe("rate limit", () => {
  it("allows up to the limit, then refuses until the window resets", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i += 1) assertWithinRateLimit("k", 3, 1000, 0);
    expect(() => assertWithinRateLimit("k", 3, 1000, 500)).toThrow(RateLimitedError);
    expect(() => assertWithinRateLimit("other", 3, 1000, 500)).not.toThrow();
    expect(() => assertWithinRateLimit("k", 3, 1000, 1000)).not.toThrow();
  });
});
