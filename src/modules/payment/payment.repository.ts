import "server-only";
import { getDb, isUniqueViolation, type Db } from "@/lib/db";
import type { PaymentStatus } from "./payment-state";
import type { ProviderName } from "./providers/types";

const paymentSelect = {
  id: true,
  provider: true,
  mode: true,
  providerOrderId: true,
  providerPaymentId: true,
  status: true,
  amountPaise: true,
  refundedPaise: true,
  contribution: {
    select: {
      id: true,
      status: true,
      amountPaise: true,
      dreamId: true,
      weddingId: true,
      guestName: true,
      guestEmail: true,
      acknowledgmentToken: true,
      wedding: { select: { slug: true, coupleId: true } },
    },
  },
} as const;

export async function createPayment(
  data: {
    contributionId: string;
    provider: ProviderName;
    mode: "TEST" | "LIVE";
    providerOrderId: string;
    amountPaise: number;
  },
  db: Db = getDb(),
) {
  const payment = await db.payment.create({ data, select: paymentSelect });
  await db.paymentStatusTransition.create({
    data: { paymentId: payment.id, fromStatus: null, toStatus: "CREATED", source: "SYSTEM" },
  });
  return payment;
}

export async function findPaymentByContributionId(contributionId: string, db: Db = getDb()) {
  return db.payment.findUnique({ where: { contributionId }, select: paymentSelect });
}

export async function findPaymentByOrder(
  provider: ProviderName,
  providerOrderId: string,
  db: Db = getDb(),
) {
  return db.payment.findUnique({
    where: { provider_providerOrderId: { provider, providerOrderId } },
    select: paymentSelect,
  });
}

/**
 * Locks the payment row for the rest of the transaction and returns its current
 * state. Every status change goes through this, so two deliveries of the same
 * event (or a webhook racing the browser callback) are processed one at a time.
 */
export async function lockPayment(paymentId: string, tx: Db) {
  await tx.$queryRaw`SELECT 1 FROM "Payment" WHERE "id" = ${paymentId}::uuid FOR UPDATE`;
  return tx.payment.findUnique({ where: { id: paymentId }, select: paymentSelect });
}

export async function recordTransition(
  tx: Db,
  data: {
    paymentId: string;
    fromStatus: PaymentStatus;
    toStatus: PaymentStatus;
    source: "CHECKOUT_VERIFY" | "WEBHOOK" | "RECONCILIATION" | "ADMIN" | "SYSTEM";
    eventId?: string;
    note?: string;
  },
  update: {
    providerPaymentId?: string;
    method?: string;
    failureCode?: string | null;
    failureReason?: string | null;
    capturedAt?: Date;
    refundedPaise?: number;
  },
): Promise<void> {
  await tx.payment.update({
    where: { id: data.paymentId },
    data: { status: data.toStatus, ...update },
  });
  await tx.paymentStatusTransition.create({ data });
}

// ───────────────────────── Refunds ─────────────────────────

/** True if a refund for this payment is already under way or done. */
export async function hasActiveRefund(paymentId: string, db: Db): Promise<boolean> {
  const count = await db.refund.count({
    where: { paymentId, status: { in: ["REQUESTED", "PROCESSED"] } },
  });
  return count > 0;
}

export async function createRefund(
  data: {
    paymentId: string;
    provider: ProviderName;
    amountPaise: number;
    reason: string;
    initiatedByUserId: string | null;
  },
  db: Db,
) {
  return db.refund.create({ data, select: { id: true } });
}

export async function finishRefund(
  id: string,
  data: { status: "PROCESSED" | "FAILED"; providerRefundId?: string },
  db: Db = getDb(),
): Promise<void> {
  await db.refund.update({ where: { id }, data });
}

// ───────────────────────── Reconciliation ─────────────────────────

/**
 * Payments we never got a final answer for: started a while ago, not captured,
 * and recent enough that the guest may still have paid.
 */
export async function findUnresolvedPayments(
  window: { olderThan: Date; newerThan: Date },
  limit: number,
  db: Db = getDb(),
) {
  return db.payment.findMany({
    where: {
      status: { in: ["CREATED", "AUTHORIZED", "FAILED"] },
      createdAt: { lt: window.olderThan, gt: window.newerThan },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: paymentSelect,
  });
}

/**
 * Dreams whose stored totals differ from the sum of their captured gifts
 * (ADR 0004). This should always be empty; any row is a bug to investigate.
 */
export async function findFundingMismatches(db: Db = getDb()) {
  return db.$queryRaw<
    {
      dreamId: string;
      storedPaise: number;
      actualPaise: number;
      storedCount: number;
      actualCount: number;
    }[]
  >`
    SELECT d."id" AS "dreamId",
           d."fundedPaise" AS "storedPaise",
           COALESCE(SUM(c."amountPaise"), 0)::int AS "actualPaise",
           d."contributionCount" AS "storedCount",
           COUNT(c."id")::int AS "actualCount"
    FROM "Dream" d
    LEFT JOIN "Contribution" c
      ON c."dreamId" = d."id"
     AND EXISTS (
       SELECT 1 FROM "Payment" p
       WHERE p."contributionId" = c."id" AND p."status" IN ('CAPTURED', 'PARTIALLY_REFUNDED')
     )
    GROUP BY d."id"
    HAVING d."fundedPaise" <> COALESCE(SUM(c."amountPaise"), 0)
        OR d."contributionCount" <> COUNT(c."id")`;
}

// ───────────────────────── Webhook events ─────────────────────────

export async function findEvent(provider: ProviderName, providerEventId: string, db: Db = getDb()) {
  return db.paymentEvent.findUnique({
    where: { provider_providerEventId: { provider, providerEventId } },
    select: { id: true, status: true },
  });
}

/**
 * Stores a webhook delivery before any processing. Returns created=false when
 * this event id has been seen before (the unique key makes that race-safe).
 */
export async function storeEvent(
  data: { provider: ProviderName; providerEventId: string; eventType: string; payload: unknown },
  db: Db = getDb(),
): Promise<{ id: string; status: string; created: boolean }> {
  try {
    const event = await db.paymentEvent.create({
      data: { ...data, payload: data.payload as object },
      select: { id: true, status: true },
    });
    return { ...event, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await findEvent(data.provider, data.providerEventId, db);
    if (!existing) throw error;
    return { ...existing, created: false };
  }
}

export async function finishEvent(
  id: string,
  data: { status: "PROCESSED" | "IGNORED" | "FAILED"; paymentId?: string; error?: string | null },
  db: Db = getDb(),
): Promise<void> {
  await db.paymentEvent.update({
    where: { id },
    data: { ...data, processedAt: data.status === "FAILED" ? null : new Date() },
  });
}

export type PaymentRecord = NonNullable<Awaited<ReturnType<typeof findPaymentByContributionId>>>;
