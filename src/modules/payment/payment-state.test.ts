import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  countsTowardsFunding,
  IllegalTransitionError,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "./payment-state";

const allowed: [PaymentStatus, PaymentStatus][] = [
  ["CREATED", "AUTHORIZED"],
  ["CREATED", "CAPTURED"],
  ["CREATED", "FAILED"],
  ["AUTHORIZED", "CAPTURED"],
  ["AUTHORIZED", "FAILED"],
  ["FAILED", "AUTHORIZED"],
  ["FAILED", "CAPTURED"],
  ["CAPTURED", "PARTIALLY_REFUNDED"],
  ["CAPTURED", "REFUNDED"],
  ["PARTIALLY_REFUNDED", "PARTIALLY_REFUNDED"],
  ["PARTIALLY_REFUNDED", "REFUNDED"],
];

describe("payment state machine", () => {
  it.each(allowed)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("rejects every transition that is not explicitly allowed", () => {
    const allowedKeys = new Set(allowed.map(([from, to]) => `${from}>${to}`));
    for (const from of PAYMENT_STATUSES) {
      for (const to of PAYMENT_STATUSES) {
        expect(canTransition(from, to)).toBe(allowedKeys.has(`${from}>${to}`));
      }
    }
  });

  it("never lets captured money go back to an unpaid state", () => {
    for (const to of ["CREATED", "AUTHORIZED", "FAILED"] as const) {
      expect(canTransition("CAPTURED", to)).toBe(false);
      expect(canTransition("PARTIALLY_REFUNDED", to)).toBe(false);
    }
  });

  it("treats REFUNDED as final", () => {
    for (const to of PAYMENT_STATUSES) expect(canTransition("REFUNDED", to)).toBe(false);
  });

  it("throws a typed error on an illegal transition", () => {
    expect(() => assertTransition("REFUNDED", "CAPTURED")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("CREATED", "CAPTURED")).not.toThrow();
  });

  it("counts only held money towards a dream", () => {
    expect(PAYMENT_STATUSES.filter(countsTowardsFunding)).toEqual([
      "CAPTURED",
      "PARTIALLY_REFUNDED",
    ]);
  });
});
