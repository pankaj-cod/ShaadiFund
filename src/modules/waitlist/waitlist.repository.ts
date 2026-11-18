import "server-only";
import { getDb, type Db } from "@/lib/db";
import type { CursorPosition } from "@/lib/pagination";
import type { WaitlistData } from "./waitlist.schema";

/**
 * Adds someone, or refreshes their details if they sign up again. The original
 * sign-up date is kept. Returns whether this email is new.
 */
export async function upsertWaitlistEntry(
  data: Omit<WaitlistData, "consent">,
  db: Db = getDb(),
): Promise<{ created: boolean }> {
  const existing = await db.waitlistEntry.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  const fields = {
    name: data.name ?? null,
    role: data.role,
    weddingMonth: data.weddingMonth ?? null,
    city: data.city ?? null,
    consentAt: new Date(),
  };
  await db.waitlistEntry.upsert({
    where: { email: data.email },
    create: { email: data.email, source: data.source, ...fields },
    update: fields,
  });
  return { created: !existing };
}

export async function listWaitlist(limit: number, cursor: CursorPosition | null, db: Db = getDb()) {
  return db.waitlistEntry.findMany({
    where: cursor
      ? { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] }
      : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
}

export async function countWaitlistByRole(db: Db = getDb()) {
  const rows = await db.waitlistEntry.groupBy({ by: ["role"], _count: true });
  return Object.fromEntries(rows.map((row) => [row.role, row._count])) as Record<string, number>;
}

/** Everything, oldest first, for the spreadsheet download. */
export async function allWaitlistEntries(db: Db = getDb()) {
  return db.waitlistEntry.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

export type WaitlistRecord = Awaited<ReturnType<typeof allWaitlistEntries>>[number];
