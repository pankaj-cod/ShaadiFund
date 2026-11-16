import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { route } from "@/lib/http";
import { respondToWebhook } from "@/lib/webhook-route";

/**
 * Razorpay webhook endpoint. Configure it in the Razorpay dashboard with the
 * events payment.captured and payment.failed, and put the secret you choose
 * there in RAZORPAY_WEBHOOK_SECRET. Without that secret every delivery is
 * refused as unsigned.
 */
export const POST = route(async (request: Request) => {
  if (getEnv().PAYMENTS_MODE === "mock") throw new NotFoundError();
  return respondToWebhook(
    request,
    request.headers.get("x-razorpay-signature"),
    request.headers.get("x-razorpay-event-id"),
  );
});
