import "server-only";
import { isUniqueViolation } from "@/lib/db";
import { decodeCursor, toPage } from "@/lib/pagination";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { assertAdmin } from "@/modules/admin/admin.service";
import { track } from "@/modules/analytics/analytics.service";
import type { Actor } from "@/modules/auth/session";
import {
  allWaitlistEntries,
  countWaitlistByRole,
  listWaitlist,
  upsertWaitlistEntry,
  type WaitlistRecord,
} from "./waitlist.repository";
import { waitlistInputSchema } from "./waitlist.schema";

/**
 * Joins the early-access list. The answer is the same whether or not the
 * address was already on it, so the form cannot be used to find out who has
 * signed up.
 */
export async function joinWaitlist(input: unknown, clientKey: string): Promise<void> {
  await assertWithinRateLimit(`waitlist:${clientKey}`, 10, 10 * 60 * 1000);
  const { consent: _consent, ...data } = waitlistInputSchema.parse(input);
  let created = false;
  try {
    ({ created } = await upsertWaitlistEntry(data));
  } catch (error) {
    // Two submissions of a new address at the same moment: the other one won.
    if (!isUniqueViolation(error)) throw error;
  }
  if (created)
    await track("waitlist_joined", { properties: { role: data.role, source: data.source } });
}

const PAGE_SIZE = 50;

export async function getWaitlist(actor: Actor, cursor?: string | null) {
  await assertAdmin(actor);
  const [rows, byRole] = await Promise.all([
    listWaitlist(PAGE_SIZE, decodeCursor(cursor)),
    countWaitlistByRole(),
  ]);
  const page = toPage(rows, PAGE_SIZE, (row) => ({ at: row.createdAt, id: row.id }));
  const total = Object.values(byRole).reduce((sum, count) => sum + count, 0);
  return { ...page, byRole, total };
}

/** A value made safe for a spreadsheet cell: quoted, and never read as a formula. */
export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(entries: WaitlistRecord[]): string {
  const header = ["Joined", "Email", "Name", "Role", "Wedding month", "City", "Source"];
  const lines = entries.map((entry) =>
    [
      entry.createdAt.toISOString(),
      entry.email,
      entry.name,
      entry.role,
      entry.weddingMonth,
      entry.city,
      entry.source,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}

export async function exportWaitlistCsv(actor: Actor): Promise<string> {
  await assertAdmin(actor);
  return toCsv(await allWaitlistEntries());
}
