import { describe, expect, it } from "vitest";
import { MockProvider, parseMockPaymentId } from "./mock";
import { InvalidSignatureError } from "./types";

const provider = new MockProvider("secret-one");
const other = new MockProvider("secret-two");

describe("mock payment provider", () => {
  it("creates unique orders", async () => {
    const input = { amountPaise: 100, currency: "INR", receipt: "r" } as const;
    const [a, b] = await Promise.all([provider.createOrder(input), provider.createOrder(input)]);
    expect(a.providerOrderId).not.toBe(b.providerOrderId);
  });

  it("verifies its own checkout signature", () => {
    const callback = provider.simulatePayment("mockorder_1", 512_500, "captured");
    expect(provider.verifyCheckoutSignature(callback)).toBe(true);
  });

  it("rejects a signature made for a different order, payment or secret", () => {
    const callback = provider.simulatePayment("mockorder_1", 512_500, "captured");
    expect(provider.verifyCheckoutSignature({ ...callback, providerOrderId: "mockorder_2" })).toBe(
      false,
    );
    expect(
      provider.verifyCheckoutSignature({
        ...callback,
        providerPaymentId: callback.providerPaymentId.replace("512500", "1"),
      }),
    ).toBe(false);
    expect(provider.verifyCheckoutSignature({ ...callback, signature: "" })).toBe(false);
    expect(other.verifyCheckoutSignature(callback)).toBe(false);
  });

  it("reports status and amount as the source of truth", async () => {
    const paid = provider.simulatePayment("o", 512_500, "captured");
    const failed = provider.simulatePayment("o", 512_500, "failed");
    expect(await provider.fetchPayment(paid.providerPaymentId)).toMatchObject({
      status: "captured",
      amountPaise: 512_500,
    });
    expect(await provider.fetchPayment(failed.providerPaymentId)).toMatchObject({
      status: "failed",
    });
    await expect(provider.fetchPayment("pay_made_up")).rejects.toThrow();
    expect(parseMockPaymentId("mockpay_captured_-5_x")).toBeNull();
  });

  it("parses a correctly signed webhook", () => {
    const callback = provider.simulatePayment("mockorder_1", 512_500, "captured");
    const { rawBody, signature } = provider.buildWebhook(callback, "evt_1");
    expect(provider.parseWebhook(rawBody, signature)).toMatchObject({
      providerEventId: "evt_1",
      type: "payment.captured",
      providerOrderId: "mockorder_1",
      payment: { status: "captured", amountPaise: 512_500 },
    });
  });

  it("rejects a webhook whose body was altered or signed with another secret", () => {
    const callback = provider.simulatePayment("mockorder_1", 100, "captured");
    const { rawBody, signature } = provider.buildWebhook(callback);
    expect(() => provider.parseWebhook(rawBody.replace("_100_", "_999999_"), signature)).toThrow(
      InvalidSignatureError,
    );
    expect(() => provider.parseWebhook(rawBody, "")).toThrow(InvalidSignatureError);
    expect(() => other.parseWebhook(rawBody, signature)).toThrow(InvalidSignatureError);
  });
});
