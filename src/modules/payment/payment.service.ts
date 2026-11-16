import "server-only";
import { timingSafeEqual } from "node:crypto";
import { inTransaction } from "@/lib/db";
import { getEnv, isDemoPayments } from "@/lib/env";
import { ConflictError, NotFoundError, PaymentError } from "@/lib/errors";
import { coupleNames } from "@/lib/format";
import { logger } from "@/lib/logger";
import { formatPaise } from "@/lib/money";
import { track } from "@/modules/analytics/analytics.service";
import { recordAudit } from "@/modules/audit/audit.repository";
import {
  findContributionDetail,
  setContributionStatus,
} from "@/modules/contribution/contribution.repository";
import { findCoupleEmails } from "@/modules/couple/couple.repository";
import { addFunding, removeFunding } from "@/modules/dream/dream.repository";
import { enqueueNotification } from "@/modules/notification/notification.repository";
import type { GiftEmailData } from "@/modules/notification/templates";
import { canTransition } from "./payment-state";
import {
  createRefund,
  findFundingMismatches,
  findPaymentByContributionId,
  findPaymentByOrder,
  findUnresolvedPayments,
  finishEvent,
  finishRefund,
  hasActiveRefund,
  lockPayment,
  recordTransition,
  storeEvent,
  type PaymentRecord,
} from "./payment.repository";
import { getPaymentProvider } from "./providers";
import type { CheckoutCallback, ProviderPayment } from "./providers/types";

type Source = "CHECKOUT_VERIFY" | "WEBHOOK" | "RECONCILIATION";

export interface PaymentOutcome {
  /** Public address of the wedding whose cached page should be refreshed, if anything changed. */
  slug: string | null;
  status: "CONFIRMED" | "PENDING" | "FAILED";
}

// ───────────────────────── Capture: the only place a gift becomes real ─────────────────────────

/**
 * Records that the provider captured a payment, exactly once (ADR 0004).
 *
 * One transaction: lock the payment, stop if it is already captured, check the
 * amount, mark payment and contribution, add the gift to the dream's totals,
 * write the audit trail and queue the emails. The browser callback, the
 * webhook and reconciliation can all call this for the same payment in any
 * order or at the same moment; the totals move once.
 */
export async function applyCapture(input: {
  paymentId: string;
  provider: ProviderPayment;
  source: Source;
  eventId?: string;
}): Promise<{ slug: string; applied: boolean }> {
  const result = await inTransaction(async (tx) => {
    const payment = await lockPayment(input.paymentId, tx);
    if (!payment) throw new NotFoundError("Payment not found.");
    const { contribution } = payment;
    const slug = contribution.wedding.slug;

    if (
      payment.status !== "CREATED" &&
      payment.status !== "AUTHORIZED" &&
      payment.status !== "FAILED"
    ) {
      return { slug, applied: false, where: null };
    }
    if (input.provider.amountPaise !== payment.amountPaise) {
      // Never credit a gift whose paid amount differs from what we asked for.
      throw new PaymentError(
        `Captured amount ${input.provider.amountPaise} does not match expected ${payment.amountPaise}.`,
      );
    }

    await recordTransition(
      tx,
      {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: "CAPTURED",
        source: input.source,
        eventId: input.eventId,
      },
      {
        providerPaymentId: input.provider.providerPaymentId,
        method: input.provider.method,
        failureCode: null,
        failureReason: null,
        capturedAt: new Date(),
      },
    );
    await setContributionStatus(contribution.id, "CONFIRMED", tx);
    // The dream receives the gift amount only, never the platform fee.
    await addFunding(contribution.dreamId, contribution.amountPaise, tx);
    await recordAudit(tx, {
      actorUserId: null,
      actorType: input.source === "WEBHOOK" ? "WEBHOOK" : "SYSTEM",
      action: "payment.captured",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        amountPaise: payment.amountPaise,
        giftPaise: contribution.amountPaise,
        mode: payment.mode,
      },
    });
    await queueGiftEmails(tx, contribution.id);
    return {
      slug,
      applied: true,
      where: { weddingId: contribution.weddingId, dreamId: contribution.dreamId },
    };
  });
  if (result.where) await track("contribution_succeeded", result.where);
  return { slug: result.slug, applied: result.applied };
}

async function queueGiftEmails(
  tx: Parameters<typeof enqueueNotification>[0],
  contributionId: string,
) {
  const detail = await findContributionDetail({ id: contributionId }, tx);
  if (!detail) return;
  const env = getEnv();
  const base: Omit<GiftEmailData, "url"> = {
    coupleNames: coupleNames(
      detail.wedding.couple.partnerOneName,
      detail.wedding.couple.partnerTwoName,
    ),
    dreamTitle: detail.dream.title,
    guestName: detail.guestName,
    amount: formatPaise(detail.amountPaise),
    fee: formatPaise(detail.platformFeePaise),
    total: formatPaise(detail.totalPaise),
    message: detail.message?.body ?? null,
    demo: isDemoPayments(env),
  };
  await enqueueNotification(tx, {
    type: "gift_receipt",
    recipient: detail.guestEmail,
    payload: { ...base, url: `${env.APP_URL}/gift/${detail.acknowledgmentToken}` },
    dedupeKey: `gift_receipt:${contributionId}`,
  });
  for (const email of await findCoupleEmails(detail.wedding.coupleId, tx)) {
    await enqueueNotification(tx, {
      type: "gift_received",
      recipient: email,
      payload: { ...base, url: `${env.APP_URL}/dashboard` },
      dedupeKey: `gift_received:${contributionId}:${email}`,
    });
  }
}

/** Records a failed attempt. Nothing is counted; a later success on the same order still wins. */
export async function applyFailure(input: {
  paymentId: string;
  provider: ProviderPayment;
  source: Source;
  eventId?: string;
}): Promise<{ applied: boolean }> {
  const result = await inTransaction(async (tx) => {
    const payment = await lockPayment(input.paymentId, tx);
    if (!payment) throw new NotFoundError("Payment not found.");
    if (!canTransition(payment.status, "FAILED")) return { applied: false, where: null };

    await recordTransition(
      tx,
      {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: "FAILED",
        source: input.source,
        eventId: input.eventId,
      },
      {
        providerPaymentId: input.provider.providerPaymentId,
        failureCode: input.provider.failureCode ?? null,
        failureReason: input.provider.failureReason ?? null,
      },
    );
    await setContributionStatus(payment.contribution.id, "FAILED", tx);
    return {
      applied: true,
      where: { weddingId: payment.contribution.weddingId, dreamId: payment.contribution.dreamId },
    };
  });
  if (result.where) await track("payment_failed", result.where);
  return { applied: result.applied };
}

// ───────────────────────── Browser callback ─────────────────────────

function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Verifies what the provider's checkout handed the browser. The browser is
 * never trusted: the signature must be valid, and then the provider itself is
 * asked what happened to the payment and for how much.
 */
export async function verifyCheckout(
  contributionId: string,
  token: string,
  callback: CheckoutCallback,
): Promise<PaymentOutcome> {
  const payment = await findPaymentByContributionId(contributionId);
  if (!payment || !tokensMatch(payment.contribution.acknowledgmentToken, token)) {
    throw new NotFoundError("We could not find that contribution.");
  }
  const provider = getPaymentProvider();
  if (
    provider.name !== payment.provider ||
    callback.providerOrderId !== payment.providerOrderId ||
    !provider.verifyCheckoutSignature(callback)
  ) {
    logger.warn("Checkout callback failed verification", { paymentId: payment.id });
    throw new PaymentError(
      "We could not verify this payment. You have not been charged twice; please contact support if money left your account.",
    );
  }

  let truth = await provider.fetchPayment(callback.providerPaymentId);
  if (truth.status === "authorized" && truth.amountPaise === payment.amountPaise) {
    // Orders ask for automatic capture; this covers an account configured otherwise.
    truth = await provider.capturePayment(truth.providerPaymentId, payment.amountPaise);
  }
  if (truth.status === "captured") {
    const { slug, applied } = await applyCapture({
      paymentId: payment.id,
      provider: truth,
      source: "CHECKOUT_VERIFY",
    });
    return { slug: applied ? slug : null, status: "CONFIRMED" };
  }
  if (truth.status === "failed") {
    await applyFailure({ paymentId: payment.id, provider: truth, source: "CHECKOUT_VERIFY" });
    return { slug: null, status: "FAILED" };
  }
  return { slug: null, status: "PENDING" };
}

// ───────────────────────── Webhooks ─────────────────────────

export type WebhookResult =
  { outcome: "processed"; slug: string | null } | { outcome: "duplicate" | "ignored" };

/**
 * Handles one webhook delivery: verify the signature, store the event, then
 * process it. A delivery we have already processed is acknowledged and does
 * nothing. A processing failure is recorded and re-thrown so the provider
 * retries. Throws InvalidSignatureError for a bad signature.
 */
export async function handleProviderWebhook(
  rawBody: string,
  signature: string,
  eventId?: string | null,
): Promise<WebhookResult> {
  const provider = getPaymentProvider();
  const event = provider.parseWebhook(rawBody, signature, eventId);

  const stored = await storeEvent({
    provider: provider.name,
    providerEventId: event.providerEventId,
    eventType: event.rawType,
    payload: event.payload,
  });
  if (!stored.created && (stored.status === "PROCESSED" || stored.status === "IGNORED")) {
    return { outcome: "duplicate" };
  }

  try {
    const payment =
      event.providerOrderId && event.payment
        ? await findPaymentByOrder(provider.name, event.providerOrderId)
        : null;
    if (event.type === "other" || !event.payment || !payment) {
      await finishEvent(stored.id, { status: "IGNORED", paymentId: payment?.id });
      return { outcome: "ignored" };
    }

    let slug: string | null = null;
    if (event.type === "payment.captured") {
      const result = await applyCapture({
        paymentId: payment.id,
        provider: event.payment,
        source: "WEBHOOK",
        eventId: stored.id,
      });
      slug = result.applied ? result.slug : null;
    } else {
      await applyFailure({
        paymentId: payment.id,
        provider: event.payment,
        source: "WEBHOOK",
        eventId: stored.id,
      });
    }
    await finishEvent(stored.id, { status: "PROCESSED", paymentId: payment.id, error: null });
    return { outcome: "processed", slug };
  } catch (error) {
    await finishEvent(stored.id, {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ───────────────────────── Reconciliation ─────────────────────────

const RECONCILE_AFTER_MS = 10 * 60 * 1000;
const RECONCILE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Asks the provider what really happened to one payment and applies it. */
async function reconcileOne(payment: PaymentRecord): Promise<string | null> {
  const provider = getPaymentProvider();
  if (provider.name !== payment.provider) return null;

  const attempts = await provider.listOrderPayments(payment.providerOrderId);
  let paid = attempts.find((attempt) => attempt.status === "captured");
  const authorised = attempts.find((attempt) => attempt.status === "authorized");
  if (!paid && authorised && authorised.amountPaise === payment.amountPaise) {
    paid = await provider.capturePayment(authorised.providerPaymentId, payment.amountPaise);
  }
  if (!paid || paid.status !== "captured") return null;

  const { slug, applied } = await applyCapture({
    paymentId: payment.id,
    provider: paid,
    source: "RECONCILIATION",
  });
  return applied ? slug : null;
}

/**
 * Safety net for payments we never heard back about: the guest closed the tab
 * before the callback, and the webhook was lost or not configured. Asks the
 * provider directly, so a gift that was paid is always counted.
 */
export async function reconcileUnresolvedPayments(
  now: Date = new Date(),
  limit = 50,
): Promise<{ checked: number; recovered: number; slugs: string[] }> {
  const payments = await findUnresolvedPayments(
    {
      olderThan: new Date(now.getTime() - RECONCILE_AFTER_MS),
      newerThan: new Date(now.getTime() - RECONCILE_WINDOW_MS),
    },
    limit,
  );
  const slugs: string[] = [];
  for (const payment of payments) {
    try {
      const slug = await reconcileOne(payment);
      if (slug) slugs.push(slug);
    } catch (error) {
      // One bad payment must not stop the rest; it is retried on the next run.
      logger.error("Could not reconcile payment", { paymentId: payment.id, error });
    }
  }
  return { checked: payments.length, recovered: slugs.length, slugs: [...new Set(slugs)] };
}

/** Compares every dream's stored totals with its captured gifts. Logs loudly on any difference. */
export async function checkFundingTotals(): Promise<number> {
  const mismatches = await findFundingMismatches();
  for (const mismatch of mismatches) {
    logger.error("Dream funding total does not match captured payments", { ...mismatch });
  }
  return mismatches.length;
}

// ───────────────────────── Refunds ─────────────────────────

/**
 * Returns a captured gift to the guest in full and takes it back out of the
 * dream's totals. For duplicate or mistaken charges; called by support tooling.
 *
 * The refund is recorded as REQUESTED before the provider is called, so two
 * people pressing "refund" at once cannot send the money back twice.
 */
export async function refundPayment(input: {
  paymentId: string;
  reason: string;
  initiatedByUserId: string | null;
}): Promise<{ slug: string }> {
  const provider = getPaymentProvider();

  const claimed = await inTransaction(async (tx) => {
    const payment = await lockPayment(input.paymentId, tx);
    if (!payment) throw new NotFoundError("Payment not found.");
    if (payment.provider !== provider.name) {
      throw new ConflictError("This payment was taken in a different payment mode.");
    }
    if (payment.status !== "CAPTURED" || !payment.providerPaymentId) {
      throw new ConflictError("Only a captured payment can be refunded.");
    }
    if (await hasActiveRefund(payment.id, tx)) {
      throw new ConflictError("A refund for this payment is already in progress.");
    }
    const refund = await createRefund(
      {
        paymentId: payment.id,
        provider: payment.provider,
        amountPaise: payment.amountPaise,
        reason: input.reason,
        initiatedByUserId: input.initiatedByUserId,
      },
      tx,
    );
    return { payment, refundId: refund.id, providerPaymentId: payment.providerPaymentId };
  });

  let providerRefundId: string;
  try {
    const result = await provider.refundPayment(
      claimed.providerPaymentId,
      claimed.payment.amountPaise,
      claimed.refundId,
    );
    if (result.status === "failed") throw new Error("The provider declined the refund");
    providerRefundId = result.providerRefundId;
  } catch (error) {
    await finishRefund(claimed.refundId, { status: "FAILED" });
    logger.error("Refund failed at the provider", { paymentId: input.paymentId, error });
    throw new PaymentError(
      "The payment provider could not process this refund. Nothing has changed.",
    );
  }

  return inTransaction(async (tx) => {
    const payment = await lockPayment(input.paymentId, tx);
    if (!payment) throw new NotFoundError("Payment not found.");
    await recordTransition(
      tx,
      {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: "REFUNDED",
        source: "ADMIN",
        note: input.reason,
      },
      { refundedPaise: payment.amountPaise },
    );
    await finishRefund(claimed.refundId, { status: "PROCESSED", providerRefundId }, tx);
    await setContributionStatus(payment.contribution.id, "REFUNDED", tx);
    await removeFunding(payment.contribution.dreamId, payment.contribution.amountPaise, tx);
    await recordAudit(tx, {
      actorUserId: input.initiatedByUserId,
      actorType: input.initiatedByUserId ? "ADMIN" : "SYSTEM",
      action: "payment.refunded",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { amountPaise: payment.amountPaise, reason: input.reason },
    });
    return { slug: payment.contribution.wedding.slug };
  });
}
