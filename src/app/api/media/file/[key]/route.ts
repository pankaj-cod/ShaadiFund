import { NotFoundError } from "@/lib/errors";
import { route } from "@/lib/http";
import { getMediaStorage } from "@/modules/media/storage";

/** Serves an uploaded photo. Keys are random and content never changes, so cache forever. */
export const GET = route(
  async (_request: Request, context: { params: Promise<{ key: string }> }) => {
    const { key } = await context.params;
    const bytes = await getMediaStorage().get(key);
    if (!bytes) throw new NotFoundError();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  },
);
