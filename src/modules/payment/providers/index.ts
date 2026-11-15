import "server-only";
import { createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";
import { MockProvider } from "./mock";
import type { PaymentProvider } from "./types";

let mock: MockProvider | undefined;

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

/** The provider for the configured payment mode. */
export function getPaymentProvider(): PaymentProvider {
  const mode = getEnv().PAYMENTS_MODE;
  if (mode === "mock") return getMockProvider();
  throw new Error(
    `PAYMENTS_MODE=${mode} needs the Razorpay provider, which is not built yet. Use PAYMENTS_MODE=mock.`,
  );
}

/** Stored on each payment so demo and real records can never be mixed up in reports. */
export function currentPaymentMode(): "TEST" | "LIVE" {
  return getEnv().PAYMENTS_MODE === "live" ? "LIVE" : "TEST";
}
