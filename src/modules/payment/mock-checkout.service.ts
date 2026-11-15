import "server-only";
import { NotFoundError, PaymentError } from "@/lib/errors";
import { findPaymentByContributionId } from "./payment.repository";
import { handleProviderWebhook } from "./payment.service";
import { getMockProvider } from "./providers";
import type { MockOutcome } from "./providers/mock";
import type { CheckoutCallback } from "./providers/types";

/**
 * Plays the part of the payment provider for the demo checkout: "takes" the
 * payment, sends our own webhook endpoint logic a signed event, and returns
 * what a real checkout would hand back to the browser.
 *
 * Only exists when PAYMENTS_MODE=mock; getMockProvider() throws otherwise.
 */
export async function simulateMockPayment(
  contributionId: string,
  token: string,
  outcome: MockOutcome,
): Promise<{ callback: CheckoutCallback; slug: string | null }> {
  const mock = getMockProvider();
  const payment = await findPaymentByContributionId(contributionId);
  if (
    !payment ||
    payment.contribution.acknowledgmentToken !== token ||
    payment.provider !== "MOCK"
  ) {
    throw new NotFoundError("We could not find that contribution.");
  }
  if (payment.status !== "CREATED" && payment.status !== "FAILED") {
    throw new PaymentError("This demo payment has already been completed.");
  }

  const callback = mock.simulatePayment(payment.providerOrderId, payment.amountPaise, outcome);
  const webhook = mock.buildWebhook(callback);
  const result = await handleProviderWebhook(webhook.rawBody, webhook.signature);
  return { callback, slug: result.outcome === "processed" ? result.slug : null };
}
