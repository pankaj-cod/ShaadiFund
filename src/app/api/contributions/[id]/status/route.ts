import { NotFoundError } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import { getGiftView } from "@/modules/contribution/contribution.service";

/** Lets the guest's confirmation screen poll while the provider's confirmation is in flight. */
export const GET = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const gift = await getGiftView(token);
  if (!gift || gift.contributionId !== id) throw new NotFoundError();
  return ok({ status: gift.status }, { headers: { "Cache-Control": "no-store" } });
});
