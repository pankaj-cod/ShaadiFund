import "server-only";
import { createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";
import { MockProvider } from "./mock";
import { RazorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./types";

let mock: MockProvider | undefined;
let razorpay: RazorpayProvider | undefined;

/** The mock provider, available only when PAYMENTS_MODE=mock. */
export function getMockProvider(): MockProvider {
  const env = getEnv();
  if (env.PAYMENTS_MODE !== "mock") {
    throw new Error("The mock payment provider is disabled unless PAYMENTS_MODE=mock");
  }
  // Derived, so the mock needs no secret of its own to configure.
  mock ??= new MockProvider(
    createHmac("sha256", env.BETTER_AUTH_SECRET).update("mock-payment-provider").digest("hex"),
  );
  return mock;
}

/**
 * The provider for the configured payment mode. Environment validation has
 * already guaranteed that test mode has test keys, and that live mode has live
 * keys and explicit approval (src/lib/env.ts).
 */
export function getPaymentProvider(): PaymentProvider {
  const env = getEnv();
  if (env.PAYMENTS_MODE === "mock") return getMockProvider();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys are not configured");
  }
  razorpay ??= new RazorpayProvider({
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  });
  return razorpay;
}

/** Stored on each payment so demo and real records can never be mixed up in reports. */
export function currentPaymentMode(): "TEST" | "LIVE" {
  return getEnv().PAYMENTS_MODE === "live" ? "LIVE" : "TEST";
}
