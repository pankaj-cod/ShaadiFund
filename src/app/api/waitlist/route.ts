import { ok, route } from "@/lib/http";
import { clientKey, readJson } from "@/lib/request";
import { joinWaitlist } from "@/modules/waitlist/waitlist.service";

/** Join the early-access list. Always answers the same way for a valid request. */
export const POST = route(async (request: Request) => {
  await joinWaitlist(await readJson(request), clientKey(request));
  return ok({ joined: true }, { headers: { "Cache-Control": "no-store" } });
});
