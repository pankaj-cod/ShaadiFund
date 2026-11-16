import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  InvalidSignatureError,
  type CheckoutCallback,
  type CreateOrderInput,
  type PaymentProvider,
  type ProviderEvent,
  type ProviderOrder,
  type ProviderPayment,
  type ProviderRefund,
} from "./types";

/**
 * A stand-in payment provider for development and automated tests. No money
 * moves and no outside service is called. It behaves like a real provider in
 * the ways that matter to our code: orders, signed checkout callbacks, signed
 * webhooks, and a payment lookup that is the source of truth.
 *
 * It needs no database: a mock payment id encodes its own outcome and amount
 * ("mockpay_captured_512500_<nonce>"), and signatures stop anyone forging one.
 * Payments it has "taken" are also remembered in memory for this process, so
 * reconciliation can be exercised in tests.
 */
export type MockOutcome = "captured" | "failed";

const PAYMENT_ID = /^mockpay_(captured|failed)_(\d{1,12})_[0-9a-f-]{36}$/;

function sign(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseMockPaymentId(providerPaymentId: string): ProviderPayment | null {
  const match = PAYMENT_ID.exec(providerPaymentId);
  if (!match) return null;
  const failed = match[1] === "failed";
  return {
    providerPaymentId,
    status: failed ? "failed" : "captured",
    amountPaise: Number(match[2]),
    method: "mock",
    failureCode: failed ? "MOCK_DECLINED" : undefined,
    failureReason: failed ? "The demo payment was declined on purpose." : undefined,
  };
}

export class MockProvider implements PaymentProvider {
  readonly name = "MOCK" as const;
  readonly publicKey = null;

  private readonly attempts = new Map<string, string[]>();

  constructor(private readonly secret: string) {}

  async createOrder(_input: CreateOrderInput): Promise<ProviderOrder> {
    return { providerOrderId: `mockorder_${randomUUID()}` };
  }

  verifyCheckoutSignature(callback: CheckoutCallback): boolean {
    const expected = sign(this.secret, `${callback.providerOrderId}|${callback.providerPaymentId}`);
    return safeEqual(expected, callback.signature);
  }

  parseWebhook(rawBody: string, signature: string, _eventId?: string | null): ProviderEvent {
    if (!safeEqual(sign(this.secret, rawBody), signature)) throw new InvalidSignatureError();
    const body = JSON.parse(rawBody) as {
      id: string;
      type: string;
      orderId?: string;
      paymentId?: string;
    };
    const payment = body.paymentId ? (parseMockPaymentId(body.paymentId) ?? undefined) : undefined;
    const type =
      body.type === "payment.captured" || body.type === "payment.failed" ? body.type : "other";
    return {
      providerEventId: body.id,
      type,
      rawType: body.type,
      providerOrderId: body.orderId,
      payment,
      payload: body,
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<ProviderPayment> {
    const payment = parseMockPaymentId(providerPaymentId);
    if (!payment) throw new Error("Unknown mock payment");
    return payment;
  }

  /** Attempts made in this process. A restarted server remembers none, like a provider outage. */
  async listOrderPayments(providerOrderId: string): Promise<ProviderPayment[]> {
    return (this.attempts.get(providerOrderId) ?? []).flatMap((id) => parseMockPaymentId(id) ?? []);
  }

  async capturePayment(providerPaymentId: string, _amountPaise: number): Promise<ProviderPayment> {
    return this.fetchPayment(providerPaymentId);
  }

  async refundPayment(
    providerPaymentId: string,
    amountPaise: number,
    _reference: string,
  ): Promise<ProviderRefund> {
    const payment = await this.fetchPayment(providerPaymentId);
    if (payment.status !== "captured")
      throw new Error("Only captured mock payments can be refunded");
    return { providerRefundId: `mockrfnd_${randomUUID()}`, status: "processed", amountPaise };
  }

  // ── What the provider's own side would do. Used only by the demo checkout and tests. ──

  /** The provider "takes" a payment and returns what its checkout would hand the browser. */
  simulatePayment(
    providerOrderId: string,
    amountPaise: number,
    outcome: MockOutcome,
  ): CheckoutCallback {
    const providerPaymentId = `mockpay_${outcome}_${amountPaise}_${randomUUID()}`;
    this.attempts.set(providerOrderId, [
      ...(this.attempts.get(providerOrderId) ?? []),
      providerPaymentId,
    ]);
    return {
      providerOrderId,
      providerPaymentId,
      signature: sign(this.secret, `${providerOrderId}|${providerPaymentId}`),
    };
  }

  /** The signed webhook the provider would send for that payment. */
  buildWebhook(
    callback: Pick<CheckoutCallback, "providerOrderId" | "providerPaymentId">,
    eventId: string = `mockevt_${randomUUID()}`,
  ): { rawBody: string; signature: string } {
    const outcome = parseMockPaymentId(callback.providerPaymentId)?.status;
    const rawBody = JSON.stringify({
      id: eventId,
      type: outcome === "failed" ? "payment.failed" : "payment.captured",
      orderId: callback.providerOrderId,
      paymentId: callback.providerPaymentId,
    });
    return { rawBody, signature: sign(this.secret, rawBody) };
  }
}
