import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { weddingTag } from "@/lib/cache-tags";
import { ok, route } from "@/lib/http";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { clientKey, readJson } from "@/lib/request";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import { verifyCheckout } from "@/modules/payment/payment.service";

const bodySchema = z.object({
  token: z.string().min(20).max(100),
  providerOrderId: z.string().min(1).max(200),
  providerPaymentId: z.string().min(1).max(200),
  signature: z.string().min(1).max(500),
});

/** Guest checkout, step two: verify what the provider's checkout returned to the browser. */
export const POST = route(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertWithinRateLimit(`verify:${clientKey(request)}`, 30, 10 * 60 * 1000);
    const { id } = await context.params;
    const { token, ...callback } = bodySchema.parse(await readJson(request));

    const outcome = await verifyCheckout(id, token, callback);
    if (outcome.slug) revalidateTag(weddingTag(outcome.slug), { expire: 0 });
    after(() => dispatchNotifications());
    return ok({ status: outcome.status });
  },
);
