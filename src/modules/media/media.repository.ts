import "server-only";
import { getDb, type Db } from "@/lib/db";

const assetSelect = { id: true, url: true, width: true, height: true, kind: true } as const;

export async function createMediaAsset(
  data: {
    coupleId: string;
    kind: "HERO" | "PROFILE" | "DREAM_COVER";
    providerPublicId: string;
    url: string;
    mimeType: string;
    bytes: number;
    width: number;
    height: number;
  },
  db: Db = getDb(),
) {
  return db.mediaAsset.create({ data, select: assetSelect });
}

/** An unused dream-cover image belonging to this couple, or null. */
export async function findAttachableCover(assetId: string, coupleId: string, db: Db = getDb()) {
  return db.mediaAsset.findFirst({
    where: { id: assetId, coupleId, kind: "DREAM_COVER" },
    select: { id: true, coverForDream: { select: { id: true } } },
  });
}
