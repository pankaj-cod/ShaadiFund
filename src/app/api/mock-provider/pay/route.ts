import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { weddingTag } from "@/lib/cache-tags";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import { readJson } from "@/lib/request";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import { simulateMockPayment } from "@/modules/payment/mock-checkout.service";

const bodySchema = z.object({
  contributionId: z.uuid(),
  token: z.string().min(20).max(100),
  outcome: z.enum(["captured", "failed"]),
});

/**
 * The demo checkout's "Pay" button. Stands in for the provider's own hosted
 * checkout and does not exist outside mock mode. No money moves.
 */
export const POST = route(async (request: Request) => {
  if (getEnv().PAYMENTS_MODE !== "mock") throw new NotFoundError();
  const { contributionId, token, outcome } = bodySchema.parse(await readJson(request));
  const { callback, slug } = await simulateMockPayment(contributionId, token, outcome);
  if (slug) revalidateTag(weddingTag(slug), { expire: 0 });
  after(() => dispatchNotifications());
  return ok(callback);
});
