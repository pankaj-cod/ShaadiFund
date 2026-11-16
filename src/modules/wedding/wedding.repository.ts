import "server-only";
import { getDb, type Db } from "@/lib/db";

const weddingSelect = {
  id: true,
  coupleId: true,
  slug: true,
  status: true,
  theme: true,
  weddingDate: true,
  venueName: true,
  city: true,
  welcomeMessage: true,
  thankYouMessage: true,
  showProgress: true,
  showGuestNames: true,
  showGuestMessages: true,
  showAmounts: true,
  allowIndexing: true,
  publishedAt: true,
  heroImage: { select: { id: true, url: true, width: true, height: true } },
  couple: { select: { partnerOneName: true, partnerTwoName: true } },
} as const;

export async function findWeddingByCoupleId(coupleId: string, db: Db = getDb()) {
  return db.wedding.findUnique({ where: { coupleId }, select: weddingSelect });
}

export async function findWeddingBySlug(slug: string, db: Db = getDb()) {
  return db.wedding.findUnique({ where: { slug }, select: weddingSelect });
}

export async function findWeddingById(id: string, db: Db = getDb()) {
  return db.wedding.findUnique({ where: { id }, select: weddingSelect });
}

export async function slugExists(slug: string, db: Db = getDb()): Promise<boolean> {
  return (await db.wedding.count({ where: { slug } })) > 0;
}

export async function createWedding(coupleId: string, slug: string, db: Db = getDb()) {
  return db.wedding.create({ data: { coupleId, slug }, select: weddingSelect });
}

export interface WeddingUpdate {
  slug?: string;
  status?: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "SUSPENDED";
  theme?: "MINIMAL_IVORY" | "ROYAL_INDIAN" | "MODERN_EDITORIAL";
  weddingDate?: Date | null;
  venueName?: string | null;
  city?: string | null;
  welcomeMessage?: string | null;
  thankYouMessage?: string | null;
  showProgress?: boolean;
  showGuestNames?: boolean;
  showGuestMessages?: boolean;
  showAmounts?: boolean;
  allowIndexing?: boolean;
  publishedAt?: Date;
  heroImageId?: string | null;
}

export async function updateWedding(id: string, data: WeddingUpdate, db: Db = getDb()) {
  return db.wedding.update({ where: { id }, data, select: weddingSelect });
}

export type WeddingRecord = NonNullable<Awaited<ReturnType<typeof findWeddingByCoupleId>>>;
