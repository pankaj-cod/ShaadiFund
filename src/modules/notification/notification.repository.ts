import "server-only";
import { getDb, type Db } from "@/lib/db";

export const MAX_ATTEMPTS = 5;

export interface OutboxMessage {
  type: "gift_receipt" | "gift_received" | "thank_you";
  recipient: string;
  payload: Record<string, string | number | boolean | null>;
  /** Makes enqueueing idempotent: the same key is never queued twice. */
  dedupeKey: string;
}

/** Queues an email in the same transaction as the change that caused it (ADR 0005). */
export async function enqueueNotification(tx: Db, message: OutboxMessage): Promise<void> {
  await tx.notification.createMany({ data: [message], skipDuplicates: true });
}

/**
 * Claims a batch of due messages. SKIP LOCKED means two dispatchers running at
 * once never pick the same row, so nothing is sent twice.
 */
export async function claimDueNotifications(limit: number, db: Db = getDb()) {
  return db.$queryRaw<
    { id: string; type: string; recipient: string; payload: unknown; attempts: number }[]
  >`
    UPDATE "Notification" SET "status" = 'SENDING', "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" IN ('PENDING', 'FAILED')
        AND "attempts" < ${MAX_ATTEMPTS}
        AND "scheduledAt" <= now()
      ORDER BY "scheduledAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "recipient", "payload", "attempts"`;
}

export async function markNotificationSent(id: string, db: Db = getDb()): Promise<void> {
  await db.notification.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), lastError: null },
  });
}

/** Schedules a retry with a growing delay (1, 4, 9, 16 minutes). */
export async function markNotificationFailed(
  id: string,
  attempts: number,
  error: string,
  db: Db = getDb(),
): Promise<void> {
  await db.notification.update({
    where: { id },
    data: {
      status: "FAILED",
      lastError: error.slice(0, 500),
      scheduledAt: new Date(Date.now() + attempts * attempts * 60_000),
    },
  });
}
