import { cacheLife, cacheTag } from "next/cache";
import { weddingTag } from "@/lib/cache-tags";
import { getPublicWedding } from "@/modules/wedding/wedding.service";
import type { PublicWedding } from "@/modules/wedding/wedding.types";

/**
 * The guest-facing wedding, cached and shared by every visitor (ARCHITECTURE.md §8).
 * It contains only public data. Any change by the couple, and later any captured
 * payment, expires the tag so the next visitor sees fresh content.
 */
export async function getCachedPublicWedding(slug: string): Promise<PublicWedding | null> {
  "use cache";
  cacheTag(weddingTag(slug));
  cacheLife("hours");
  return getPublicWedding(slug);
}
