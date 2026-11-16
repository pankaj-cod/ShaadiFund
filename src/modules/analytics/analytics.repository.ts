import "server-only";
import { getDb, type Db } from "@/lib/db";

export async function insertAnalyticsEvent(
  data: {
    name: string;
    weddingId?: string | null;
    dreamId?: string | null;
    sessionHash?: string | null;
    properties?: Record<string, string | number | boolean>;
  },
  db: Db = getDb(),
): Promise<void> {
  await db.analyticsEvent.create({ data });
}

/** A published wedding's id by its public address, for attributing page views. */
export async function findPublishedWeddingId(
  slug: string,
  db: Db = getDb(),
): Promise<string | null> {
  const wedding = await db.wedding.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });
  return wedding?.id ?? null;
}
