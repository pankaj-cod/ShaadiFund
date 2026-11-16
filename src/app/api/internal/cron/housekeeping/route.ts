import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { weddingTag } from "@/lib/cache-tags";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import { expireAbandonedContributions } from "@/modules/contribution/contribution.service";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import { checkFundingTotals, reconcileUnresolvedPayments } from "@/modules/payment/payment.service";

function authorised(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled job: recovers payments we never heard back about, closes abandoned
 * checkouts, checks every dream's totals against captured payments, and retries queued emails.
 * Answers 404 unless CRON_SECRET is configured and sent as a bearer token.
 */
async function run(request: Request): Promise<Response> {
  const secret = getEnv().CRON_SECRET;
  if (!secret || !authorised(request, secret)) throw new NotFoundError();
  // Order matters: recover paid gifts before closing checkouts as abandoned.
  const reconciled = await reconcileUnresolvedPayments();
  for (const slug of reconciled.slugs) revalidateTag(weddingTag(slug), { expire: 0 });
  const expired = await expireAbandonedContributions();
  const fundingMismatches = await checkFundingTotals();
  const emails = await dispatchNotifications(50);
  return ok({
    reconciled: { checked: reconciled.checked, recovered: reconciled.recovered },
    expiredContributions: expired,
    fundingMismatches,
    emails,
  });
}

export const GET = route(run);
export const POST = route(run);
