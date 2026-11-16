import "server-only";
import { getDb, type Db } from "@/lib/db";
import type { CursorPosition } from "@/lib/pagination";

export type ModeFilter = "TEST" | "LIVE" | null;

const before = (cursor: CursorPosition | null) =>
  cursor
    ? { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] }
    : {};
const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

// ───────────────────────── Metrics ─────────────────────────

export async function loadMetrics(mode: ModeFilter, db: Db = getDb()) {
  const paymentMode = mode ? { mode } : {};
  const [
    couples,
    publishedWeddings,
    confirmed,
    paymentsByStatus,
    checkouts,
    guests,
    visitors,
    categories,
  ] = await Promise.all([
    db.couple.count(),
    db.wedding.count({ where: { status: "PUBLISHED" } }),
    db.contribution.aggregate({
      where: { status: "CONFIRMED", payment: paymentMode },
      _count: true,
      _sum: { amountPaise: true, platformFeePaise: true },
    }),
    db.payment.groupBy({ by: ["status"], where: paymentMode, _count: true }),
    db.contribution.count({ where: { payment: paymentMode } }),
    db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT c."guestEmail")::int AS count
        FROM "Contribution" c JOIN "Payment" p ON p."contributionId" = c."id"
        WHERE c."status" = 'CONFIRMED' AND (${mode}::text IS NULL OR p."mode"::text = ${mode})`,
    db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT "sessionHash")::int AS count
        FROM "AnalyticsEvent" WHERE "name" = 'wedding_page_viewed'`,
    db.$queryRaw<{ category: string; gifts: number; paise: number }[]>`
        SELECT d."category"::text AS category, COUNT(*)::int AS gifts, SUM(c."amountPaise")::int AS paise
        FROM "Contribution" c
        JOIN "Dream" d ON d."id" = c."dreamId"
        JOIN "Payment" p ON p."contributionId" = c."id"
        WHERE c."status" = 'CONFIRMED' AND (${mode}::text IS NULL OR p."mode"::text = ${mode})
        GROUP BY d."category" ORDER BY gifts DESC, paise DESC`,
  ]);
  return {
    couples,
    publishedWeddings,
    confirmedCount: confirmed._count,
    volumePaise: confirmed._sum.amountPaise ?? 0,
    feesPaise: confirmed._sum.platformFeePaise ?? 0,
    paymentsByStatus: Object.fromEntries(paymentsByStatus.map((row) => [row.status, row._count])),
    checkouts,
    guests: guests[0]?.count ?? 0,
    visitors: visitors[0]?.count ?? 0,
    categories,
  };
}

// ───────────────────────── Couples ─────────────────────────

export async function listCouples(limit: number, cursor: CursorPosition | null, db: Db = getDb()) {
  return db.couple.findMany({
    where: before(cursor),
    orderBy: newestFirst,
    take: limit + 1,
    select: {
      id: true,
      createdAt: true,
      partnerOneName: true,
      partnerTwoName: true,
      members: { select: { user: { select: { email: true } } } },
      wedding: {
        select: {
          id: true,
          slug: true,
          status: true,
          _count: { select: { dreams: { where: { deletedAt: null } } } },
          dreams: { where: { deletedAt: null }, select: { fundedPaise: true } },
        },
      },
    },
  });
}

// ───────────────────────── Payments ─────────────────────────

const paymentListSelect = {
  id: true,
  createdAt: true,
  status: true,
  mode: true,
  provider: true,
  amountPaise: true,
  contribution: {
    select: {
      guestName: true,
      guestEmail: true,
      amountPaise: true,
      dream: { select: { title: true } },
      wedding: { select: { slug: true } },
    },
  },
} as const;

export async function listPayments(
  filter: { status?: string | null },
  limit: number,
  cursor: CursorPosition | null,
  db: Db = getDb(),
) {
  const statuses = [
    "CREATED",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ] as const;
  const status = statuses.find((candidate) => candidate === filter.status);
  return db.payment.findMany({
    where: { ...(status ? { status } : {}), ...before(cursor) },
    orderBy: newestFirst,
    take: limit + 1,
    select: paymentListSelect,
  });
}

export async function findPaymentDetail(id: string, db: Db = getDb()) {
  return db.payment.findUnique({
    where: { id },
    select: {
      ...paymentListSelect,
      providerOrderId: true,
      providerPaymentId: true,
      method: true,
      failureCode: true,
      failureReason: true,
      refundedPaise: true,
      capturedAt: true,
      transitions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          source: true,
          note: true,
          createdAt: true,
        },
      },
      events: {
        orderBy: { receivedAt: "asc" },
        select: { id: true, eventType: true, status: true, error: true, receivedAt: true },
      },
      refunds: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          amountPaise: true,
          status: true,
          reason: true,
          providerRefundId: true,
          createdAt: true,
        },
      },
    },
  });
}

// ───────────────────────── Webhook events and audit ─────────────────────────

export async function listPaymentEvents(
  filter: { status?: string | null },
  limit: number,
  db: Db = getDb(),
) {
  const statuses = ["RECEIVED", "PROCESSED", "IGNORED", "FAILED"] as const;
  const status = statuses.find((candidate) => candidate === filter.status);
  return db.paymentEvent.findMany({
    where: status ? { status } : {},
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      id: true,
      provider: true,
      providerEventId: true,
      eventType: true,
      status: true,
      error: true,
      receivedAt: true,
      processedAt: true,
      paymentId: true,
    },
  });
}

export async function listAuditLogs(
  limit: number,
  cursor: CursorPosition | null,
  db: Db = getDb(),
) {
  return db.auditLog.findMany({
    where: before(cursor),
    orderBy: newestFirst,
    take: limit + 1,
    select: {
      id: true,
      createdAt: true,
      actorType: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      actor: { select: { email: true } },
    },
  });
}
