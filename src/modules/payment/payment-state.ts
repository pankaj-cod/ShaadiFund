/**
 * Payment status state machine (ADR 0003). Pure, so every rule is unit tested.
 *
 *   CREATED -> AUTHORIZED -> CAPTURED -> PARTIALLY_REFUNDED -> REFUNDED
 *   CREATED | AUTHORIZED -> FAILED
 *   FAILED -> AUTHORIZED | CAPTURED   (a guest may retry inside the same provider order)
 *
 * Money that was captured can only move forward into refund states; nothing
 * ever returns to CREATED, and REFUNDED is final.
 */
export const PAYMENT_STATUSES = [
  "CREATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const ALLOWED: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ["AUTHORIZED", "CAPTURED", "FAILED"],
  AUTHORIZED: ["CAPTURED", "FAILED"],
  FAILED: ["AUTHORIZED", "CAPTURED"],
  CAPTURED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: PaymentStatus,
    readonly to: PaymentStatus,
  ) {
    super(`Illegal payment transition ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

/** A contribution counts towards a dream only while its payment holds captured money. */
export function countsTowardsFunding(status: PaymentStatus): boolean {
  return status === "CAPTURED" || status === "PARTIALLY_REFUNDED";
}
