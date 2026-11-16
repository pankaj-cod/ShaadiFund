import { describe, expect, it } from "vitest";
import { RazorpayApiError, RazorpayProvider } from "@/modules/payment/providers/razorpay";

const keyId = process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
// Only ever against Razorpay's test environment, and only when test keys are present
// (a developer's machine). CI has no keys, so this file is skipped there.
const hasTestKeys = keyId.startsWith("rzp_test_") && keySecret.length > 0;

describe.skipIf(!hasTestKeys)("Razorpay test API (real network calls, no money)", () => {
  const provider = new RazorpayProvider({ keyId, keySecret });

  it("creates an order and reports that nothing has been paid against it", async () => {
    const order = await provider.createOrder({
      amountPaise: 512_500,
      currency: "INR",
      receipt: `it-${Date.now()}`,
    });
    expect(order.providerOrderId).toMatch(/^order_/);
    expect(await provider.listOrderPayments(order.providerOrderId)).toEqual([]);
  }, 20_000);

  it("reports an unknown payment as a typed error", async () => {
    await expect(provider.fetchPayment("pay_doesnotexist00")).rejects.toBeInstanceOf(
      RazorpayApiError,
    );
  }, 20_000);

  it("is rejected with the wrong secret", async () => {
    const wrong = new RazorpayProvider({ keyId, keySecret: "wrong-secret" });
    await expect(
      wrong.createOrder({ amountPaise: 100, currency: "INR", receipt: "x" }),
    ).rejects.toMatchObject({ status: 401 });
  }, 20_000);
});
