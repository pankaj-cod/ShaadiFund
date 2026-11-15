import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { weddingTag } from "@/lib/cache-tags";
import { getEnv } from "@/lib/env";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import { handleProviderWebhook } from "@/modules/payment/payment.service";
import { InvalidSignatureError } from "@/modules/payment/providers/types";

/**
 * Webhook endpoint for the mock provider. Exists only in mock mode. The same
 * pipeline (verify, store, deduplicate, process) will serve Razorpay.
 * A processing failure returns 500 so a real provider would retry.
 */
export const POST = route(async (request: Request) => {
  if (getEnv().PAYMENTS_MODE !== "mock") throw new NotFoundError();
  const rawBody = await request.text();
  try {
    const result = await handleProviderWebhook(
      rawBody,
      request.headers.get("x-mock-signature") ?? "",
    );
    if (result.outcome === "processed" && result.slug) {
      revalidateTag(weddingTag(result.slug), { expire: 0 });
    }
    after(() => dispatchNotifications());
    return ok({ outcome: result.outcome });
  } catch (error) {
    if (error instanceof InvalidSignatureError) throw new ValidationError("Invalid signature.");
    throw error;
  }
});
