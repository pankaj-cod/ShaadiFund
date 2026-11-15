import "server-only";
import { getDb, type Db } from "@/lib/db";
import type { DreamCategory } from "./dream.schema";

const dreamSelect = {
  id: true,
  weddingId: true,
  title: true,
  description: true,
  category: true,
  targetPaise: true,
  fundedPaise: true,
  contributionCount: true,
  displayOrder: true,
  isActive: true,
  coverImage: { select: { id: true, url: true, width: true, height: true } },
} as const;

/** Dreams of a wedding that have not been deleted, in display order. */
export async function listDreams(weddingId: string, db: Db = getDb()) {
  return db.dream.findMany({
    where: { weddingId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: dreamSelect,
  });
}

export async function countDreams(weddingId: string, db: Db = getDb()): Promise<number> {
  return db.dream.count({ where: { weddingId, deletedAt: null } });
}

/**
 * Finds a dream only if the given user belongs to the couple that owns it.
 * Ownership is part of the query, so a stranger's id behaves exactly like a missing one.
 */
export async function findDreamOwnedByUser(dreamId: string, userId: string, db: Db = getDb()) {
  return db.dream.findFirst({
    where: {
      id: dreamId,
      deletedAt: null,
      wedding: { couple: { members: { some: { userId } } } },
    },
    select: dreamSelect,
  });
}

export interface DreamData {
  title: string;
  description: string;
  category: DreamCategory;
  targetPaise: number;
  isActive: boolean;
  coverImageId: string | null;
}

export async function createDream(
  weddingId: string,
  data: DreamData & { displayOrder: number },
  db: Db = getDb(),
) {
  return db.dream.create({ data: { weddingId, ...data }, select: dreamSelect });
}

export async function updateDream(id: string, data: Partial<DreamData>, db: Db = getDb()) {
  return db.dream.update({ where: { id }, data, select: dreamSelect });
}

export async function softDeleteDream(id: string, db: Db = getDb()): Promise<void> {
  // The cover image link is released so the unique constraint does not block reuse.
  await db.dream.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, coverImageId: null },
  });
}

export async function hardDeleteDream(id: string, db: Db = getDb()): Promise<void> {
  await db.dream.delete({ where: { id } });
}

export async function setDisplayOrder(id: string, displayOrder: number, db: Db = getDb()) {
  await db.dream.update({ where: { id }, data: { displayOrder } });
}

export type DreamRecord = Awaited<ReturnType<typeof listDreams>>[number];

/** A dream a guest may contribute to: active, not deleted, on a published wedding. */
export async function findContributableDream(dreamId: string, slug: string, db: Db = getDb()) {
  return db.dream.findFirst({
    where: {
      id: dreamId,
      deletedAt: null,
      isActive: true,
      wedding: { slug, status: "PUBLISHED" },
    },
    select: { id: true, title: true, weddingId: true },
  });
}

/**
 * Adds a verified gift to a dream's totals as one atomic UPDATE (ADR 0004).
 * Only the payment service calls this, inside the capture transaction.
 */
export async function addFunding(dreamId: string, amountPaise: number, tx: Db): Promise<void> {
  await tx.dream.update({
    where: { id: dreamId },
    data: { fundedPaise: { increment: amountPaise }, contributionCount: { increment: 1 } },
  });
}
