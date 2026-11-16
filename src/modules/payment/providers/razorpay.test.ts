import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RazorpayApiError, RazorpayProvider, toProviderPayment } from "./razorpay";
import { InvalidSignatureError } from "./types";

const KEY_ID = "rzp_test_unitTestKey";
const KEY_SECRET = "unit-test-secret";
const WEBHOOK_SECRET = "unit-test-webhook-secret";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function providerWith(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  const provider = new RazorpayProvider({
    keyId: KEY_ID,
    keySecret: KEY_SECRET,
    webhookSecret: WEBHOOK_SECRET,
    fetch: fetchMock,
  });
  return { provider, fetchMock };
}

const sign = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex");

describe("RazorpayProvider", () => {
  it("exposes only the key id to the browser", () => {
    const { provider } = providerWith(json({}));
    expect(provider.publicKey).toBe(KEY_ID);
    expect(JSON.stringify({ name: provider.name, publicKey: provider.publicKey })).not.toContain(
      KEY_SECRET,
    );
  });

  it("creates an order for the exact amount with automatic capture, authenticated by basic auth", async () => {
    const { provider, fetchMock } = providerWith(json({ id: "order_abc" }));
    const order = await provider.createOrder({
      amountPaise: 512_500,
      currency: "INR",
      receipt: "contrib-1",
    });
    expect(order).toEqual({ providerOrderId: "order_abc" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
    );
    expect(JSON.parse(init?.body as string)).toMatchObject({
      amount: 512_500,
      currency: "INR",
      receipt: "contrib-1",
      payment: { capture: "automatic" },
    });
  });

  it("turns an API error into a typed error", async () => {
    const { provider } = providerWith(
      json(
        { error: { code: "BAD_REQUEST_ERROR", description: "The id provided does not exist" } },
        400,
      ),
    );
    await expect(provider.fetchPayment("pay_missing")).rejects.toMatchObject({
      name: "RazorpayApiError",
      status: 400,
      code: "BAD_REQUEST_ERROR",
    });
    const { provider: broken } = providerWith(
      new Response("<html>gateway</html>", { status: 502 }),
    );
    await expect(broken.fetchPayment("pay_x")).rejects.toBeInstanceOf(RazorpayApiError);
  });

  it("verifies the checkout signature Razorpay documents: HMAC of order_id|payment_id", () => {
    const { provider } = providerWith(json({}));
    const callback = {
      providerOrderId: "order_abc",
      providerPaymentId: "pay_xyz",
      signature: sign(KEY_SECRET, "order_abc|pay_xyz"),
    };
    expect(provider.verifyCheckoutSignature(callback)).toBe(true);
    expect(provider.verifyCheckoutSignature({ ...callback, providerPaymentId: "pay_other" })).toBe(
      false,
    );
    expect(provider.verifyCheckoutSignature({ ...callback, providerOrderId: "order_other" })).toBe(
      false,
    );
    expect(
      provider.verifyCheckoutSignature({
        ...callback,
        signature: sign("wrong", "order_abc|pay_xyz"),
      }),
    ).toBe(false);
    expect(provider.verifyCheckoutSignature({ ...callback, signature: "" })).toBe(false);
  });

  describe("webhooks", () => {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_xyz",
            order_id: "order_abc",
            amount: 512_500,
            status: "captured",
            method: "upi",
          },
        },
      },
    });

    it("parses a correctly signed payment.captured event", () => {
      const { provider } = providerWith(json({}));
      expect(provider.parseWebhook(body, sign(WEBHOOK_SECRET, body), "evt_123")).toMatchObject({
        providerEventId: "evt_123",
        type: "payment.captured",
        providerOrderId: "order_abc",
        payment: {
          providerPaymentId: "pay_xyz",
          status: "captured",
          amountPaise: 512_500,
          method: "upi",
        },
      });
    });

    it("rejects a bad signature, an altered body, and a signature made with the API secret", () => {
      const { provider } = providerWith(json({}));
      expect(() => provider.parseWebhook(body, "nope", "evt")).toThrow(InvalidSignatureError);
      expect(() => provider.parseWebhook(body, "", "evt")).toThrow(InvalidSignatureError);
      expect(() =>
        provider.parseWebhook(body.replace("512500", "1"), sign(WEBHOOK_SECRET, body), "evt"),
      ).toThrow(InvalidSignatureError);
      expect(() => provider.parseWebhook(body, sign(KEY_SECRET, body), "evt")).toThrow(
        InvalidSignatureError,
      );
    });

    it("refuses every webhook when no webhook secret is configured", () => {
      const provider = new RazorpayProvider({ keyId: KEY_ID, keySecret: KEY_SECRET });
      expect(() => provider.parseWebhook(body, sign("", body), "evt")).toThrow(
        InvalidSignatureError,
      );
    });

    it("falls back to a stable id from the body when the delivery id header is missing", () => {
      const { provider } = providerWith(json({}));
      const first = provider.parseWebhook(body, sign(WEBHOOK_SECRET, body));
      const second = provider.parseWebhook(body, sign(WEBHOOK_SECRET, body), null);
      expect(first.providerEventId).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(second.providerEventId).toBe(first.providerEventId);
    });

    it("treats events it does not act on as 'other'", () => {
      const { provider } = providerWith(json({}));
      const other = JSON.stringify({ event: "order.paid", payload: {} });
      expect(provider.parseWebhook(other, sign(WEBHOOK_SECRET, other), "e")).toMatchObject({
        type: "other",
        rawType: "order.paid",
        payment: undefined,
      });
    });
  });

  it("maps Razorpay payment statuses", () => {
    const base = { id: "pay_1", amount: 100 };
    expect(toProviderPayment({ ...base, status: "captured" }).status).toBe("captured");
    expect(toProviderPayment({ ...base, status: "authorized" }).status).toBe("authorized");
    expect(toProviderPayment({ ...base, status: "created" }).status).toBe("pending");
    expect(toProviderPayment({ ...base, status: "refunded" }).status).toBe("captured");
    expect(
      toProviderPayment({
        ...base,
        status: "failed",
        error_code: "BAD_REQUEST_ERROR",
        error_description: "Declined",
      }),
    ).toMatchObject({
      status: "failed",
      failureCode: "BAD_REQUEST_ERROR",
      failureReason: "Declined",
    });
  });

  it("lists an order's attempts, captures and refunds through the documented endpoints", async () => {
    const list = providerWith(
      json({
        items: [
          { id: "pay_1", amount: 100, status: "failed" },
          { id: "pay_2", amount: 100, status: "captured" },
        ],
      }),
    );
    expect((await list.provider.listOrderPayments("order_abc")).map((p) => p.status)).toEqual([
      "failed",
      "captured",
    ]);
    expect(list.fetchMock.mock.calls[0]![0]).toBe(
      "https://api.razorpay.com/v1/orders/order_abc/payments",
    );

    const capture = providerWith(json({ id: "pay_1", amount: 100, status: "captured" }));
    await capture.provider.capturePayment("pay_1", 100);
    expect(capture.fetchMock.mock.calls[0]![0]).toBe(
      "https://api.razorpay.com/v1/payments/pay_1/capture",
    );
    expect(JSON.parse(capture.fetchMock.mock.calls[0]![1]?.body as string)).toEqual({
      amount: 100,
      currency: "INR",
    });

    const refund = providerWith(json({ id: "rfnd_1", amount: 100, status: "processed" }));
    expect(await refund.provider.refundPayment("pay_1", 100, "ref-1")).toEqual({
      providerRefundId: "rfnd_1",
      status: "processed",
      amountPaise: 100,
    });
    expect(refund.fetchMock.mock.calls[0]![0]).toBe(
      "https://api.razorpay.com/v1/payments/pay_1/refund",
    );
  });
});
