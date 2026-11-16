import { route } from "@/lib/http";
import { clientKey, readJson } from "@/lib/request";
import { recordBrowserEvent } from "@/modules/analytics/analytics.service";

/** Privacy-conscious page-view beacon. Accepts only an allow-list of event names. */
export const POST = route(async (request: Request) => {
  await recordBrowserEvent(await readJson(request), {
    address: clientKey(request),
    userAgent: request.headers.get("user-agent") ?? "",
  });
  return new Response(null, { status: 204 });
});
