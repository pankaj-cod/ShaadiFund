import "server-only";
import { randomBytes } from "node:crypto";
import { isUniqueViolation } from "@/lib/db";
import { getEnv, isDemoPayments } from "@/lib/env";
import { NotFoundError, PaymentError } from "@/lib/errors";
import { coupleNames } from "@/lib/format";
import { logger } from "@/lib/logger";
import { calculateContributionTotals, rupeesToPaise } from "@/lib/money";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { findContributableDream } from "@/modules/dream/dream.repository";
import { createPayment, findPaymentByContributionId } from "@/modules/payment/payment.repository";
import { currentPaymentMode, getPaymentProvider } from "@/modules/payment/providers";
import {
  createContribution,
  expireStaleContributions,
  findByIdempotencyKey,
  findContributionDetail,
  type ContributionRecord,
} from "./contribution.repository";
import { CONTRIBUTION_CONFIG, contributionInputSchema } from "./contribution.schema";
import type { CheckoutSession, GiftView } from "./contribution.types";

const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Starts a guest's checkout: validates the gift, records it as PENDING and
 * opens an order with the payment provider. Nothing counts towards the dream
 * until the provider confirms capture (payment.service).
 *
 * Submitting the same form twice returns the same contribution and order.
 */
export async function startContribution(
  slug: string,
  rawInput: unknown,
  clientKey: string,
): Promise<CheckoutSession> {
  assertWithinRateLimit(`checkout:${clientKey}`, 20, 10 * 60 * 1000);
  const input = contributionInputSchema.parse(rawInput);

  let contribution = await findByIdempotencyKey(input.idempotencyKey);
  if (!contribution) {
    const dream = await findContributableDream(input.dreamId, slug);
    if (!dream) throw new NotFoundError("This dream is not open for contributions right now.");

    // Fee and total are always computed here, never taken from the browser.
    const totals = calculateContributionTotals(
      rupeesToPaise(input.amountRupees),
      CONTRIBUTION_CONFIG.feeBasisPoints,
    );
    try {
      contribution = await createContribution({
        dreamId: dream.id,
        weddingId: dream.weddingId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        isAnonymous: input.isAnonymous,
        ...totals,
        idempotencyKey: input.idempotencyKey,
        acknowledgmentToken: randomBytes(32).toString("base64url"),
        message: input.message
          ? { body: input.message, visibility: input.messageVisibility }
          : null,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A double submit raced us; use the row the other request created.
      contribution = await findByIdempotencyKey(input.idempotencyKey);
      if (!contribution) throw error;
    }
  }
  return toCheckoutSession(contribution, await ensurePayment(contribution));
}

async function ensurePayment(contribution: ContributionRecord) {
  const existing = await findPaymentByContributionId(contribution.id);
  if (existing) return existing;

  const provider = getPaymentProvider();
  let order;
  try {
    order = await provider.createOrder({
      amountPaise: contribution.totalPaise,
      currency: "INR",
      receipt: contribution.id,
    });
  } catch (error) {
    logger.error("Payment provider could not create an order", {
      contributionId: contribution.id,
      error,
    });
    throw new PaymentError(
      "We could not start the payment. Nothing was charged. Please try again.",
    );
  }
  try {
    return await createPayment({
      contributionId: contribution.id,
      provider: provider.name,
      mode: currentPaymentMode(),
      providerOrderId: order.providerOrderId,
      amountPaise: contribution.totalPaise,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findPaymentByContributionId(contribution.id);
    if (!raced) throw error;
    return raced;
  }
}

function toCheckoutSession(
  contribution: ContributionRecord,
  payment: { provider: "MOCK" | "RAZORPAY"; mode: "TEST" | "LIVE"; providerOrderId: string },
): CheckoutSession {
  return {
    contributionId: contribution.id,
    acknowledgmentToken: contribution.acknowledgmentToken,
    status: contribution.status,
    amountPaise: contribution.amountPaise,
    platformFeePaise: contribution.platformFeePaise,
    totalPaise: contribution.totalPaise,
    payment: { provider: payment.provider, mode: payment.mode, orderId: payment.providerOrderId },
  };
}

/**
 * The guest's view of their own gift. The unguessable token in their link is
 * the only credential, so an unknown token and a missing gift look the same.
 */
export async function getGiftView(token: string): Promise<GiftView | null> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const detail = await findContributionDetail({ acknowledgmentToken: token });
  if (!detail) return null;
  return {
    contributionId: detail.id,
    status: detail.status,
    guestName: detail.guestName,
    coupleNames: coupleNames(
      detail.wedding.couple.partnerOneName,
      detail.wedding.couple.partnerTwoName,
    ),
    slug: detail.wedding.slug,
    theme: detail.wedding.theme,
    dreamId: detail.dream.id,
    dreamTitle: detail.dream.title,
    amountPaise: detail.amountPaise,
    platformFeePaise: detail.platformFeePaise,
    totalPaise: detail.totalPaise,
    message: detail.message?.body ?? null,
    coupleReply: detail.message?.coupleReply ?? null,
    provider: detail.payment?.provider ?? null,
    demo: detail.payment ? detail.payment.mode === "TEST" : isDemoPayments(getEnv()),
  };
}

/** Housekeeping: checkouts started over an hour ago and never paid are closed. */
export async function expireAbandonedContributions(now: Date = new Date()): Promise<number> {
  return expireStaleContributions(new Date(now.getTime() - STALE_AFTER_MS));
}
