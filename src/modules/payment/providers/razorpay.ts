import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  InvalidSignatureError,
  type CheckoutCallback,
  type CreateOrderInput,
  type PaymentProvider,
  type ProviderEvent,
  type ProviderOrder,
  type ProviderPayment,
  type ProviderPaymentStatus,
  type ProviderRefund,
} from "./types";

const API_BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 15_000;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  /** Set in the Razorpay dashboard when the webhook is created. Webhooks are refused without it. */
  webhookSecret?: string;
  /** Replaceable in tests. */
  fetch?: typeof fetch;
}

export class RazorpayApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    description: string,
  ) {
    super(`Razorpay ${status} ${code}: ${description}`);
    this.name = "RazorpayApiError";
  }
}

interface RazorpayPayment {
  id: string;
  order_id?: string | null;
  amount: number;
  status: string;
  method?: string | null;
  error_code?: string | null;
  error_description?: string | null;
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const STATUS_MAP: Record<string, ProviderPaymentStatus> = {
  captured: "captured",
  authorized: "authorized",
  failed: "failed",
  // A refunded payment was captured first; refunds are tracked separately.
  refunded: "captured",
};

export function toProviderPayment(payment: RazorpayPayment): ProviderPayment {
  return {
    providerPaymentId: payment.id,
    status: STATUS_MAP[payment.status] ?? "pending",
    amountPaise: payment.amount,
    method: payment.method ?? undefined,
    failureCode: payment.error_code ?? undefined,
    failureReason: payment.error_description ?? undefined,
  };
}

/**
 * Razorpay, behind the same interface as the mock (ADR 0003). The mode (test or
 * live) is decided entirely by which keys are configured; this class does not
 * know or care. The key secret never leaves the server.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "RAZORPAY" as const;
  readonly publicKey: string;
  private readonly authorization: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: RazorpayConfig) {
    this.publicKey = config.keyId;
    this.authorization = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: this.authorization,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await response.json().catch(() => null)) as
      (T & { error?: { code?: string; description?: string } }) | null;
    if (!response.ok || !json || json.error) {
      throw new RazorpayApiError(
        response.status,
        json?.error?.code ?? "UNKNOWN",
        json?.error?.description ?? "Unexpected response",
      );
    }
    return json;
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const order = await this.request<{ id: string }>("POST", "/orders", {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      // Capture as soon as the bank authorises, so a paid gift is never left half-done.
      payment: { capture: "automatic", capture_options: { refund_speed: "normal" } },
      notes: { contribution_id: input.receipt },
    });
    return { providerOrderId: order.id };
  }

  verifyCheckoutSignature(callback: CheckoutCallback): boolean {
    const expected = hmac(
      this.config.keySecret,
      `${callback.providerOrderId}|${callback.providerPaymentId}`,
    );
    return safeEqual(expected, callback.signature);
  }

  parseWebhook(rawBody: string, signature: string, eventId?: string | null): ProviderEvent {
    const secret = this.config.webhookSecret;
    if (!secret || !signature || !safeEqual(hmac(secret, rawBody), signature)) {
      throw new InvalidSignatureError();
    }
    const body = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: RazorpayPayment } };
    };
    const entity = body.payload?.payment?.entity;
    const rawType = body.event ?? "unknown";
    const type = rawType === "payment.captured" || rawType === "payment.failed" ? rawType : "other";
    return {
      // Razorpay sends the delivery id in a header. Without it, the body's hash still deduplicates retries.
      providerEventId: eventId || `sha256:${createHash("sha256").update(rawBody).digest("hex")}`,
      type,
      rawType,
      providerOrderId: entity?.order_id ?? undefined,
      payment: entity ? toProviderPayment(entity) : undefined,
      payload: body,
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<ProviderPayment> {
    return toProviderPayment(
      await this.request<RazorpayPayment>(
        "GET",
        `/payments/${encodeURIComponent(providerPaymentId)}`,
      ),
    );
  }

  async listOrderPayments(providerOrderId: string): Promise<ProviderPayment[]> {
    const result = await this.request<{ items: RazorpayPayment[] }>(
      "GET",
      `/orders/${encodeURIComponent(providerOrderId)}/payments`,
    );
    return result.items.map(toProviderPayment);
  }

  async capturePayment(providerPaymentId: string, amountPaise: number): Promise<ProviderPayment> {
    return toProviderPayment(
      await this.request<RazorpayPayment>(
        "POST",
        `/payments/${encodeURIComponent(providerPaymentId)}/capture`,
        { amount: amountPaise, currency: "INR" },
      ),
    );
  }

  async refundPayment(
    providerPaymentId: string,
    amountPaise: number,
    reference: string,
  ): Promise<ProviderRefund> {
    const refund = await this.request<{ id: string; status: string; amount: number }>(
      "POST",
      `/payments/${encodeURIComponent(providerPaymentId)}/refund`,
      { amount: amountPaise, speed: "normal", receipt: reference },
    );
    return {
      providerRefundId: refund.id,
      status:
        refund.status === "processed"
          ? "processed"
          : refund.status === "failed"
            ? "failed"
            : "pending",
      amountPaise: refund.amount,
    };
  }
}
