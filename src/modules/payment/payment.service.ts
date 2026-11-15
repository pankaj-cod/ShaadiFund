import "server-only";
import { timingSafeEqual } from "node:crypto";
import { inTransaction } from "@/lib/db";
import { getEnv, isDemoPayments } from "@/lib/env";
import { NotFoundError, PaymentError } from "@/lib/errors";
import { coupleNames } from "@/lib/format";
import { logger } from "@/lib/logger";
import { formatPaise } from "@/lib/money";
import { recordAudit } from "@/modules/audit/audit.repository";
import {
  findContributionDetail,
  setContributionStatus,
} from "@/modules/contribution/contribution.repository";
import { findCoupleEmails } from "@/modules/couple/couple.repository";
import { addFunding } from "@/modules/dream/dream.repository";
import { enqueueNotification } from "@/modules/notification/notification.repository";
import type { GiftEmailData } from "@/modules/notification/templates";
import { canTransition } from "./payment-state";
import {
  findPaymentByContributionId,
  findPaymentByOrder,
  finishEvent,
  lockPayment,
  recordTransition,
  storeEvent,
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
  return inTransaction(async (tx) => {
    const payment = await lockPayment(input.paymentId, tx);
    if (!payment) throw new NotFoundError("Payment not found.");
    const { contribution } = payment;
    const slug = contribution.wedding.slug;

    if (
      payment.status !== "CREATED" &&
      payment.status !== "AUTHORIZED" &&
      payment.status !== "FAILED"
    ) {
      return { slug, applied: false };
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
    return { slug, applied: true };
  });
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
  return inTransaction(async (tx) => {
    const payment = await lockPayment(input.paymentId, tx);
    if (!payment) throw new NotFoundError("Payment not found.");
    if (!canTransition(payment.status, "FAILED")) return { applied: false };

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
    return { applied: true };
  });
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
    callback.providerOrderId !== payment.providerOrderId ||
    !provider.verifyCheckoutSignature(callback)
  ) {
    logger.warn("Checkout callback failed verification", { paymentId: payment.id });
    throw new PaymentError(
      "We could not verify this payment. You have not been charged twice; please contact support if money left your account.",
    );
  }

  const truth = await provider.fetchPayment(callback.providerPaymentId);
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
): Promise<WebhookResult> {
  const provider = getPaymentProvider();
  const event = provider.parseWebhook(rawBody, signature);

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
