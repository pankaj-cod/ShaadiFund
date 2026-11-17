import "server-only";
import { inTransaction } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { coupleNames } from "@/lib/format";
import { decodeCursor, toPage } from "@/lib/pagination";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/modules/audit/audit.repository";
import type { Actor } from "@/modules/auth/session";
import { enqueueNotification } from "@/modules/notification/notification.repository";
import { requireOwnWedding } from "@/modules/wedding/wedding.service";
import {
  findPaidContributionForUser,
  listPaidContributions,
  saveThankYouNote,
  setMessageModeration,
  summariseConfirmedContributions,
  type CoupleGiftRecord,
} from "./contribution.repository";
import { thankYouSchema, type CoupleGift, type CoupleGiftsPage } from "./gifts.schema";

const PAGE_SIZE = 20;

function toCoupleGift(record: CoupleGiftRecord): CoupleGift {
  return {
    id: record.id,
    status: record.status === "REFUNDED" ? "REFUNDED" : "CONFIRMED",
    guestName: record.guestName,
    guestEmail: record.guestEmail,
    isAnonymous: record.isAnonymous,
    amountPaise: record.amountPaise,
    receivedAt: (record.confirmedAt ?? record.createdAt).toISOString(),
    dreamTitle: record.dream.title,
    message: record.message
      ? {
          body: record.message.body,
          isPrivate: record.message.visibility === "COUPLE_ONLY",
          isHidden: record.message.moderation === "HIDDEN",
        }
      : null,
    thankYouNote: record.thankYouNote,
  };
}

/** The couple's own gifts, newest first, with every guest's details and message. */
export async function listGifts(actor: Actor, cursor?: string | null): Promise<CoupleGiftsPage> {
  const { wedding } = await requireOwnWedding(actor);
  const [rows, summary] = await Promise.all([
    listPaidContributions(wedding.id, { limit: PAGE_SIZE, before: decodeCursor(cursor) }),
    summariseConfirmedContributions(wedding.id),
  ]);
  const page = toPage(rows, PAGE_SIZE, (row) => ({ at: row.createdAt, id: row.id }));
  return { gifts: page.items.map(toCoupleGift), nextCursor: page.nextCursor, summary };
}

/** Hides a guest's message from the public page, or shows it again. The couple still sees it. */
export async function setGiftMessageHidden(
  actor: Actor,
  contributionId: string,
  hidden: boolean,
): Promise<{ slug: string }> {
  const gift = await findPaidContributionForUser(contributionId, actor.userId);
  if (!gift || !gift.message) throw new NotFoundError("We could not find that message.");
  await inTransaction(async (tx) => {
    await setMessageModeration(gift.id, hidden ? "HIDDEN" : "VISIBLE", tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: hidden ? "message.hidden" : "message.shown",
      entityType: "Contribution",
      entityId: gift.id,
    });
  });
  return { slug: gift.wedding.slug };
}

/**
 * Saves the couple's thank-you for one gift. The guest is emailed the first
 * time; later edits update their private page without sending another email.
 */
export async function sendThankYou(
  actor: Actor,
  contributionId: string,
  input: unknown,
): Promise<void> {
  await assertWithinRateLimit(`thank-you:${actor.userId}`, 60, 10 * 60 * 1000);
  const { note } = thankYouSchema.parse(input);
  const gift = await findPaidContributionForUser(contributionId, actor.userId);
  if (!gift) throw new NotFoundError("We could not find that gift.");

  const names = coupleNames(gift.wedding.couple.partnerOneName, gift.wedding.couple.partnerTwoName);
  await inTransaction(async (tx) => {
    await saveThankYouNote(gift.id, note, tx);
    await enqueueNotification(tx, {
      type: "thank_you",
      recipient: gift.guestEmail,
      payload: {
        coupleNames: names,
        guestName: gift.guestName,
        dreamTitle: gift.dream.title,
        note,
        url: `${getEnv().APP_URL}/gift/${gift.acknowledgmentToken}`,
      },
      dedupeKey: `thank_you:${gift.id}`,
    });
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: gift.thankYouNote ? "thank_you.edited" : "thank_you.sent",
      entityType: "Contribution",
      entityId: gift.id,
    });
  });
}
