/**
 * Money helpers. Every amount in the system is an integer number of paise
 * (ADR 0006). Nothing here uses floating-point arithmetic on money.
 */

export const PAISE_PER_RUPEE = 100;

/** Default limits; admin-editable values in PlatformConfig override these. */
export const DEFAULT_LIMITS = {
  minContributionPaise: 100 * PAISE_PER_RUPEE,
  maxContributionPaise: 500_000 * PAISE_PER_RUPEE,
  maxDreamTargetPaise: 10_000_000 * PAISE_PER_RUPEE,
} as const;

export function isValidPaise(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function assertPaise(value: number, name: string): void {
  if (!isValidPaise(value)) {
    throw new RangeError(`${name} must be a non-negative integer number of paise`);
  }
}

/**
 * Platform fee for a gift, in paise.
 * The rate is in basis points (250 = 2.5%). Rounds half up to the nearest paise
 * using integer arithmetic only.
 */
export function calculatePlatformFeePaise(amountPaise: number, feeBasisPoints: number): number {
  assertPaise(amountPaise, "amountPaise");
  if (!Number.isSafeInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 10_000) {
    throw new RangeError("feeBasisPoints must be an integer between 0 and 10000");
  }
  return Math.floor((amountPaise * feeBasisPoints + 5_000) / 10_000);
}

export interface ContributionTotals {
  amountPaise: number;
  platformFeePaise: number;
  totalPaise: number;
}

/** What a guest pays for a gift: the gift itself plus the fee shown at checkout. */
export function calculateContributionTotals(
  amountPaise: number,
  feeBasisPoints: number,
): ContributionTotals {
  const platformFeePaise = calculatePlatformFeePaise(amountPaise, feeBasisPoints);
  return { amountPaise, platformFeePaise, totalPaise: amountPaise + platformFeePaise };
}

/**
 * Funding progress as a whole percentage for display, capped at 100.
 * Rounds down so a dream never shows 100% before it is fully funded.
 */
export function fundingPercent(fundedPaise: number, targetPaise: number): number {
  assertPaise(fundedPaise, "fundedPaise");
  assertPaise(targetPaise, "targetPaise");
  if (targetPaise === 0) return 0;
  return Math.min(100, Math.floor((fundedPaise * 100) / targetPaise));
}

/** Amount still needed to reach the target; never negative when overfunded. */
export function remainingPaise(fundedPaise: number, targetPaise: number): number {
  assertPaise(fundedPaise, "fundedPaise");
  assertPaise(targetPaise, "targetPaise");
  return Math.max(0, targetPaise - fundedPaise);
}

/** Converts whole rupees typed by a person into paise. Rejects fractions of a paise. */
export function rupeesToPaise(rupees: number): number {
  const paise = Math.round(rupees * PAISE_PER_RUPEE);
  if (!Number.isFinite(rupees) || rupees < 0 || Math.abs(paise - rupees * PAISE_PER_RUPEE) > 1e-6) {
    throw new RangeError("rupees must be a non-negative amount with at most two decimal places");
  }
  return paise;
}

const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise for display, e.g. 12500000 -> "₹1,25,000". Shows paise only when present. */
export function formatPaise(paise: number): string {
  assertPaise(paise, "paise");
  const formatter = paise % PAISE_PER_RUPEE === 0 ? wholeRupees : withPaise;
  return formatter.format(paise / PAISE_PER_RUPEE);
}
