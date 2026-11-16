import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { route } from "@/lib/http";
import { respondToWebhook } from "@/lib/webhook-route";

/** Webhook endpoint for the mock provider. Exists only in mock mode. */
export const POST = route(async (request: Request) => {
  if (getEnv().PAYMENTS_MODE !== "mock") throw new NotFoundError();
  return respondToWebhook(request, request.headers.get("x-mock-signature"), null);
});
