/**
 * The seam between VowFund and any payment provider (ADR 0003). Everything the
 * rest of the app knows about a provider goes through this interface.
 */
export type ProviderName = "MOCK" | "RAZORPAY";

export interface CreateOrderInput {
  /** What the guest pays in total (gift plus fee), in paise. Always taken from our database. */
  amountPaise: number;
  currency: "INR";
  /** Our contribution id, for reconciliation on the provider's side. */
  receipt: string;
}

export interface ProviderOrder {
  providerOrderId: string;
}

/** What the provider hands the browser after checkout, to be verified on our server. */
export interface CheckoutCallback {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export type ProviderPaymentStatus = "captured" | "authorized" | "failed" | "pending";

export interface ProviderPayment {
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  amountPaise: number;
  method?: string;
  failureCode?: string;
  failureReason?: string;
}

export interface ProviderEvent {
  /** Unique per delivery-worthy event; used to deduplicate webhooks. */
  providerEventId: string;
  type: "payment.captured" | "payment.failed" | "other";
  rawType: string;
  providerOrderId?: string;
  payment?: ProviderPayment;
  /** Parsed body, stored for audit. */
  payload: unknown;
}

export class InvalidSignatureError extends Error {
  constructor() {
    super("Webhook signature is not valid");
    this.name = "InvalidSignatureError";
  }
}

export interface PaymentProvider {
  readonly name: ProviderName;
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  /** True only if the callback was signed by the provider for this exact order and payment. */
  verifyCheckoutSignature(callback: CheckoutCallback): boolean;
  /** Verifies the signature against the raw body, then parses. Throws InvalidSignatureError. */
  parseWebhook(rawBody: string, signature: string): ProviderEvent;
  /** The provider's own record of a payment: the source of truth for status and amount. */
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
}
