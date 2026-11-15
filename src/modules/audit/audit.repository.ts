import "server-only";
import type { Db } from "@/lib/db";

export interface AuditEntry {
  actorUserId: string | null;
  actorType?: "USER" | "ADMIN" | "SYSTEM" | "WEBHOOK";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/** Appends to the audit trail. Call inside the same transaction as the change it describes. */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorType: entry.actorType ?? "USER",
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  });
}
