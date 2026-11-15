import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import { expireAbandonedContributions } from "@/modules/contribution/contribution.service";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";

function authorised(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled job: retries queued emails and closes abandoned checkouts.
 * Answers 404 unless CRON_SECRET is configured and sent as a bearer token.
 */
async function run(request: Request): Promise<Response> {
  const secret = getEnv().CRON_SECRET;
  if (!secret || !authorised(request, secret)) throw new NotFoundError();
  const [emails, expired] = await Promise.all([
    dispatchNotifications(50),
    expireAbandonedContributions(),
  ]);
  return ok({ emails, expiredContributions: expired });
}

export const GET = route(run);
export const POST = route(run);
