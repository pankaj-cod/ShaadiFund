import "server-only";
import { getDb, type Db } from "@/lib/db";

const contributionSelect = {
  id: true,
  status: true,
  amountPaise: true,
  platformFeePaise: true,
  totalPaise: true,
  acknowledgmentToken: true,
  dreamId: true,
  weddingId: true,
} as const;

export async function findByIdempotencyKey(idempotencyKey: string, db: Db = getDb()) {
  return db.contribution.findUnique({ where: { idempotencyKey }, select: contributionSelect });
}

export async function createContribution(
  data: {
    dreamId: string;
    weddingId: string;
    guestName: string;
    guestEmail: string;
    isAnonymous: boolean;
    amountPaise: number;
    platformFeePaise: number;
    totalPaise: number;
    idempotencyKey: string;
    acknowledgmentToken: string;
    message: { body: string; visibility: "PUBLIC" | "COUPLE_ONLY" } | null;
  },
  db: Db = getDb(),
) {
  const { message, ...contribution } = data;
  return db.contribution.create({
    data: {
      ...contribution,
      consentAcceptedAt: new Date(),
      message: message ? { create: { ...message, weddingId: data.weddingId } } : undefined,
    },
    select: contributionSelect,
  });
}

export async function setContributionStatus(
  id: string,
  status: "CONFIRMED" | "FAILED" | "EXPIRED" | "REFUNDED",
  tx: Db,
): Promise<void> {
  await tx.contribution.update({
    where: { id },
    data: { status, confirmedAt: status === "CONFIRMED" ? new Date() : undefined },
  });
}

/** Everything the guest's acknowledgment page and the emails need. */
export async function findContributionDetail(
  where: { id: string } | { acknowledgmentToken: string },
  db: Db = getDb(),
) {
  return db.contribution.findUnique({
    where,
    select: {
      ...contributionSelect,
      guestName: true,
      guestEmail: true,
      isAnonymous: true,
      confirmedAt: true,
      dream: { select: { id: true, title: true } },
      thankYouNote: true,
      message: { select: { body: true, visibility: true } },
      payment: { select: { status: true, mode: true, provider: true, providerOrderId: true } },
      wedding: {
        select: {
          slug: true,
          theme: true,
          coupleId: true,
          couple: { select: { partnerOneName: true, partnerTwoName: true } },
        },
      },
    },
  });
}

/** Confirmed gifts for the public page, newest first. Privacy is applied by the service. */
export async function listConfirmedContributions(
  weddingId: string,
  limit: number,
  db: Db = getDb(),
) {
  return db.contribution.findMany({
    where: { weddingId, status: "CONFIRMED" },
    orderBy: { confirmedAt: "desc" },
    take: limit,
    select: {
      id: true,
      guestName: true,
      isAnonymous: true,
      amountPaise: true,
      confirmedAt: true,
      dream: { select: { title: true } },
      message: { select: { body: true, visibility: true, moderation: true } },
    },
  });
}

/** Marks checkouts that were started but never paid as expired. Returns how many. */
export async function expireStaleContributions(olderThan: Date, db: Db = getDb()): Promise<number> {
  const result = await db.contribution.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: olderThan },
      OR: [{ payment: null }, { payment: { status: "CREATED" } }],
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export type ContributionRecord = NonNullable<Awaited<ReturnType<typeof findByIdempotencyKey>>>;

// ───────────────────────── The couple's view ─────────────────────────

const coupleGiftSelect = {
  id: true,
  status: true,
  guestName: true,
  guestEmail: true,
  isAnonymous: true,
  amountPaise: true,
  confirmedAt: true,
  createdAt: true,
  thankYouNote: true,
  thankedAt: true,
  dream: { select: { title: true } },
  message: { select: { body: true, visibility: true, moderation: true } },
} as const;

/** Gifts that were actually paid (including later refunds), newest first. */
export async function listPaidContributions(
  weddingId: string,
  options: { limit: number; before: { at: Date; id: string } | null },
  db: Db = getDb(),
) {
  const { before } = options;
  return db.contribution.findMany({
    where: {
      weddingId,
      status: { in: ["CONFIRMED", "REFUNDED"] },
      ...(before
        ? {
            OR: [{ createdAt: { lt: before.at } }, { createdAt: before.at, id: { lt: before.id } }],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    select: coupleGiftSelect,
  });
}

export async function summariseConfirmedContributions(weddingId: string, db: Db = getDb()) {
  const result = await db.contribution.aggregate({
    where: { weddingId, status: "CONFIRMED" },
    _sum: { amountPaise: true },
    _count: true,
  });
  return { totalPaise: result._sum.amountPaise ?? 0, count: result._count };
}

/** A paid gift, only if the given user belongs to the couple it was given to. */
export async function findPaidContributionForUser(
  contributionId: string,
  userId: string,
  db: Db = getDb(),
) {
  return db.contribution.findFirst({
    where: {
      id: contributionId,
      status: { in: ["CONFIRMED", "REFUNDED"] },
      wedding: { couple: { members: { some: { userId } } } },
    },
    select: {
      ...coupleGiftSelect,
      acknowledgmentToken: true,
      wedding: {
        select: { slug: true, couple: { select: { partnerOneName: true, partnerTwoName: true } } },
      },
    },
  });
}

export async function saveThankYouNote(id: string, note: string, db: Db): Promise<void> {
  await db.contribution.update({
    where: { id },
    data: { thankYouNote: note, thankedAt: new Date() },
  });
}

export async function setMessageModeration(
  contributionId: string,
  moderation: "VISIBLE" | "HIDDEN",
  db: Db,
): Promise<number> {
  const result = await db.guestMessage.updateMany({
    where: { contributionId },
    data: { moderation },
  });
  return result.count;
}

export type CoupleGiftRecord = Awaited<ReturnType<typeof listPaidContributions>>[number];
