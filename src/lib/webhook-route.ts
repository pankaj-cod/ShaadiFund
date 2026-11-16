import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { weddingTag } from "@/lib/cache-tags";
import { ValidationError } from "@/lib/errors";
import { ok } from "@/lib/http";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import { handleProviderWebhook } from "@/modules/payment/payment.service";
import { InvalidSignatureError } from "@/modules/payment/providers/types";

/**
 * The HTTP side of every provider webhook: read the raw body (signatures are
 * computed over the exact bytes), hand it to the payment service, then refresh
 * the public page and send queued emails.
 *
 * 200 once stored and processed, or already seen. 400 for a bad signature.
 * Any processing failure propagates as 500 so the provider retries.
 */
export async function respondToWebhook(
  request: Request,
  signature: string | null,
  eventId: string | null,
): Promise<Response> {
  const rawBody = await request.text();
  try {
    const result = await handleProviderWebhook(rawBody, signature ?? "", eventId);
    if (result.outcome === "processed" && result.slug) {
      revalidateTag(weddingTag(result.slug), { expire: 0 });
    }
    after(() => dispatchNotifications());
    return ok({ outcome: result.outcome });
  } catch (error) {
    if (error instanceof InvalidSignatureError) throw new ValidationError("Invalid signature.");
    throw error;
  }
}
