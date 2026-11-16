import "server-only";
import { z } from "zod";
import { inTransaction } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { decodeCursor, toPage } from "@/lib/pagination";
import { recordAudit } from "@/modules/audit/audit.repository";
import type { Actor } from "@/modules/auth/session";
import { findUserRole } from "@/modules/auth/user.repository";
import { refundPayment } from "@/modules/payment/payment.service";
import { findWeddingById, updateWedding } from "@/modules/wedding/wedding.repository";
import {
  findPaymentDetail,
  listAuditLogs,
  listCouples,
  listPaymentEvents,
  listPayments,
  loadMetrics,
  type ModeFilter,
} from "./admin.repository";

const PAGE_SIZE = 25;

/**
 * Every admin function starts here. The role is read from the database on each
 * call, so hiding a link or forging a request gains nothing (ADR 0002).
 */
export async function assertAdmin(actor: Actor): Promise<void> {
  if ((await findUserRole(actor.userId)) !== "ADMIN") {
    throw new ForbiddenError("This area is for ShaadiFund staff.");
  }
}

const ratio = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

export async function getMetrics(actor: Actor, mode: ModeFilter) {
  await assertAdmin(actor);
  const raw = await loadMetrics(mode);
  const captured = raw.paymentsByStatus.CAPTURED ?? 0;
  const failed = raw.paymentsByStatus.FAILED ?? 0;
  return {
    couples: raw.couples,
    publishedWeddings: raw.publishedWeddings,
    guests: raw.guests,
    contributions: raw.confirmedCount,
    volumePaise: raw.volumePaise,
    feesPaise: raw.feesPaise,
    checkouts: raw.checkouts,
    visitors: raw.visitors,
    /** Of checkouts that were started, the share that ended in a confirmed gift. */
    checkoutConversion: ratio(raw.confirmedCount, raw.checkouts),
    /** Of payment attempts that reached a final answer, the share that succeeded. */
    paymentSuccessRate: ratio(captured, captured + failed),
    categories: raw.categories,
  };
}

export async function getCouples(actor: Actor, cursor?: string | null) {
  await assertAdmin(actor);
  const rows = await listCouples(PAGE_SIZE, decodeCursor(cursor));
  const page = toPage(rows, PAGE_SIZE, (row) => ({ at: row.createdAt, id: row.id }));
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((couple) => ({
      id: couple.id,
      createdAt: couple.createdAt.toISOString(),
      partnerOneName: couple.partnerOneName,
      partnerTwoName: couple.partnerTwoName,
      emails: couple.members.map((member) => member.user.email),
      wedding: couple.wedding
        ? {
            id: couple.wedding.id,
            slug: couple.wedding.slug,
            status: couple.wedding.status,
            dreamCount: couple.wedding._count.dreams,
            raisedPaise: couple.wedding.dreams.reduce((sum, dream) => sum + dream.fundedPaise, 0),
          }
        : null,
    })),
  };
}

export async function getPayments(
  actor: Actor,
  filter: { status?: string | null },
  cursor?: string | null,
) {
  await assertAdmin(actor);
  const rows = await listPayments(filter, PAGE_SIZE, decodeCursor(cursor));
  return toPage(rows, PAGE_SIZE, (row) => ({ at: row.createdAt, id: row.id }));
}

export async function getPayment(actor: Actor, paymentId: string) {
  await assertAdmin(actor);
  if (!z.uuid().safeParse(paymentId).success) return null;
  return findPaymentDetail(paymentId);
}

export async function getPaymentEvents(actor: Actor, filter: { status?: string | null }) {
  await assertAdmin(actor);
  return listPaymentEvents(filter, 100);
}

export async function getAuditLogs(actor: Actor, cursor?: string | null) {
  await assertAdmin(actor);
  const rows = await listAuditLogs(50, decodeCursor(cursor));
  return toPage(rows, 50, (row) => ({ at: row.createdAt, id: row.id }));
}

const reasonSchema = z.object({
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(300),
});

/** Takes a wedding page offline. The couple cannot republish until it is restored. */
export async function suspendWedding(
  actor: Actor,
  weddingId: string,
  input: unknown,
): Promise<{ slug: string }> {
  await assertAdmin(actor);
  const { reason } = reasonSchema.parse(input);
  const wedding = await findWeddingById(weddingId);
  if (!wedding) throw new NotFoundError("Wedding not found.");
  if (wedding.status === "SUSPENDED") throw new ConflictError("This page is already suspended.");
  await inTransaction(async (tx) => {
    await updateWedding(wedding.id, { status: "SUSPENDED" }, tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      actorType: "ADMIN",
      action: "wedding.suspended",
      entityType: "Wedding",
      entityId: wedding.id,
      metadata: { reason, previousStatus: wedding.status },
    });
  });
  return { slug: wedding.slug };
}

/** Lifts a suspension. The page comes back hidden; the couple chooses when to publish again. */
export async function restoreWedding(actor: Actor, weddingId: string): Promise<{ slug: string }> {
  await assertAdmin(actor);
  const wedding = await findWeddingById(weddingId);
  if (!wedding) throw new NotFoundError("Wedding not found.");
  if (wedding.status !== "SUSPENDED") throw new ConflictError("This page is not suspended.");
  await inTransaction(async (tx) => {
    await updateWedding(wedding.id, { status: "UNPUBLISHED" }, tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      actorType: "ADMIN",
      action: "wedding.restored",
      entityType: "Wedding",
      entityId: wedding.id,
    });
  });
  return { slug: wedding.slug };
}

/** Refunds a captured payment in full, recording who did it and why. */
export async function refundAsAdmin(
  actor: Actor,
  paymentId: string,
  input: unknown,
): Promise<{ slug: string }> {
  await assertAdmin(actor);
  const { reason } = reasonSchema.parse(input);
  return refundPayment({ paymentId, reason, initiatedByUserId: actor.userId });
}
