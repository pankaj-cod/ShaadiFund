import { ok, route } from "@/lib/http";
import { clientKey, readJson } from "@/lib/request";
import { startContribution } from "@/modules/contribution/contribution.service";

/** Guest checkout, step one: record the gift as pending and open a provider order. */
export const POST = route(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const session = await startContribution(slug, await readJson(request), clientKey(request));
    return ok(session, { status: 201 });
  },
);
