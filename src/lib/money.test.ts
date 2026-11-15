import { describe, expect, it } from "vitest";
import {
  calculateContributionTotals,
  calculatePlatformFeePaise,
  formatPaise,
  fundingPercent,
  remainingPaise,
  rupeesToPaise,
} from "./money";

describe("calculatePlatformFeePaise", () => {
  it("charges nothing at a zero rate", () => {
    expect(calculatePlatformFeePaise(500_000, 0)).toBe(0);
  });

  it("calculates 2.5% of ₹5,000 exactly", () => {
    expect(calculatePlatformFeePaise(500_000, 250)).toBe(12_500);
  });

  it("rounds half a paise up", () => {
    // 2.5% of ₹1.00 is 2.5 paise
    expect(calculatePlatformFeePaise(100, 250)).toBe(3);
  });

  it("rounds below half a paise down", () => {
    // 2.5% of 99 paise is 2.475 paise
    expect(calculatePlatformFeePaise(99, 250)).toBe(2);
  });

  it("always returns an integer for awkward amounts", () => {
    for (const amount of [1, 33, 101, 999_999, 12_345_678]) {
      expect(Number.isInteger(calculatePlatformFeePaise(amount, 237))).toBe(true);
    }
  });

  it("rejects fractional, negative and unsafe amounts", () => {
    expect(() => calculatePlatformFeePaise(100.5, 250)).toThrow(RangeError);
    expect(() => calculatePlatformFeePaise(-1, 250)).toThrow(RangeError);
    expect(() => calculatePlatformFeePaise(Number.NaN, 250)).toThrow(RangeError);
  });

  it("rejects fee rates outside 0 to 100%", () => {
    expect(() => calculatePlatformFeePaise(100, -1)).toThrow(RangeError);
    expect(() => calculatePlatformFeePaise(100, 10_001)).toThrow(RangeError);
    expect(() => calculatePlatformFeePaise(100, 2.5)).toThrow(RangeError);
  });
});

describe("calculateContributionTotals", () => {
  it("total is always gift plus fee", () => {
    const totals = calculateContributionTotals(500_000, 250);
    expect(totals).toEqual({ amountPaise: 500_000, platformFeePaise: 12_500, totalPaise: 512_500 });
  });
});

describe("fundingPercent", () => {
  it("is zero when nothing is funded", () => {
    expect(fundingPercent(0, 30_000_000)).toBe(0);
  });

  it("rounds down so 100% only shows when fully funded", () => {
    expect(fundingPercent(29_999_999, 30_000_000)).toBe(99);
    expect(fundingPercent(30_000_000, 30_000_000)).toBe(100);
  });

  it("caps at 100 when a dream is overfunded", () => {
    expect(fundingPercent(45_000_000, 30_000_000)).toBe(100);
  });

  it("does not divide by zero", () => {
    expect(fundingPercent(100, 0)).toBe(0);
  });
});

describe("remainingPaise", () => {
  it("is the gap to the target", () => {
    expect(remainingPaise(18_750_000, 30_000_000)).toBe(11_250_000);
  });

  it("is never negative when overfunded", () => {
    expect(remainingPaise(45_000_000, 30_000_000)).toBe(0);
  });
});

describe("rupeesToPaise", () => {
  it("converts whole and two-decimal rupee amounts", () => {
    expect(rupeesToPaise(5000)).toBe(500_000);
    expect(rupeesToPaise(1.15)).toBe(115);
    expect(rupeesToPaise(0.07)).toBe(7);
  });

  it("rejects fractions of a paise and negatives", () => {
    expect(() => rupeesToPaise(1.005)).toThrow(RangeError);
    expect(() => rupeesToPaise(-5)).toThrow(RangeError);
    expect(() => rupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatPaise", () => {
  it("uses Indian digit grouping", () => {
    expect(formatPaise(12_500_000)).toBe("₹1,25,000");
    expect(formatPaise(1_000_000_000)).toBe("₹1,00,00,000");
  });

  it("shows paise only when there are any", () => {
    expect(formatPaise(500_000)).toBe("₹5,000");
    expect(formatPaise(512_550)).toBe("₹5,125.50");
  });
});
