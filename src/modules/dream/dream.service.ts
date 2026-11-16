import "server-only";
import { inTransaction } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { rupeesToPaise } from "@/lib/money";
import { track } from "@/modules/analytics/analytics.service";
import { recordAudit } from "@/modules/audit/audit.repository";
import type { Actor } from "@/modules/auth/session";
import { advanceOnboarding } from "@/modules/couple/couple.service";
import { findAttachableCover } from "@/modules/media/media.repository";
import { ONBOARDING_STEPS, requireOwnWedding, toDreamDTO } from "@/modules/wedding/wedding.service";
import type { DreamDTO } from "@/modules/wedding/wedding.types";
import {
  countDreams,
  createDream as insertDream,
  findDreamOwnedByUser,
  hardDeleteDream,
  listDreams,
  setDisplayOrder,
  softDeleteDream,
  updateDream as saveDream,
  type DreamData,
} from "./dream.repository";
import { dreamInputSchema, MAX_DREAMS_PER_WEDDING, reorderSchema } from "./dream.schema";

export interface DreamResult {
  dream: DreamDTO;
  slug: string;
}

/** A cover image may be attached only if this couple uploaded it and no other dream uses it. */
async function assertCoverUsable(
  coverImageId: string | null,
  coupleId: string,
  forDreamId: string | null,
): Promise<void> {
  if (!coverImageId) return;
  const asset = await findAttachableCover(coverImageId, coupleId);
  const usedElsewhere = asset?.coverForDream && asset.coverForDream.id !== forDreamId;
  if (!asset || usedElsewhere) {
    throw new ValidationError(undefined, { coverImageId: "Please upload the photo again." });
  }
}

function toDreamData(input: unknown): DreamData {
  const parsed = dreamInputSchema.parse(input);
  return {
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    targetPaise: rupeesToPaise(parsed.targetRupees),
    isActive: parsed.isActive,
    coverImageId: parsed.coverImageId,
  };
}

export async function createDream(actor: Actor, input: unknown): Promise<DreamResult> {
  const data = toDreamData(input);
  const { couple, wedding } = await requireOwnWedding(actor);
  const existing = await countDreams(wedding.id);
  if (existing >= MAX_DREAMS_PER_WEDDING) {
    throw new ValidationError(`You can list up to ${MAX_DREAMS_PER_WEDDING} dreams.`);
  }
  await assertCoverUsable(data.coverImageId, couple.id, null);

  const dream = await inTransaction(async (tx) => {
    const created = await insertDream(wedding.id, { ...data, displayOrder: existing }, tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: "dream.created",
      entityType: "Dream",
      entityId: created.id,
      metadata: { targetPaise: created.targetPaise },
    });
    await advanceOnboarding(couple, ONBOARDING_STEPS.dream, tx);
    return created;
  });
  if (existing === 0) await track("wishlist_created", { weddingId: wedding.id, dreamId: dream.id });
  return { dream: toDreamDTO(dream), slug: wedding.slug };
}

export async function updateDream(
  actor: Actor,
  dreamId: string,
  input: unknown,
): Promise<DreamResult> {
  const data = toDreamData(input);
  const { couple, wedding } = await requireOwnWedding(actor);
  const current = await findDreamOwnedByUser(dreamId, actor.userId);
  if (!current) throw new NotFoundError("We could not find that dream.");
  await assertCoverUsable(data.coverImageId, couple.id, current.id);

  const dream = await inTransaction(async (tx) => {
    const updated = await saveDream(current.id, data, tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: "dream.updated",
      entityType: "Dream",
      entityId: current.id,
      metadata:
        current.targetPaise === updated.targetPaise
          ? undefined
          : { targetFrom: current.targetPaise, targetTo: updated.targetPaise },
    });
    return updated;
  });
  return { dream: toDreamDTO(dream), slug: wedding.slug };
}

/**
 * Removes a dream. If guests have already contributed, the dream is hidden but
 * kept, so the financial history stays intact.
 */
export async function deleteDream(actor: Actor, dreamId: string): Promise<{ slug: string }> {
  const { wedding } = await requireOwnWedding(actor);
  const current = await findDreamOwnedByUser(dreamId, actor.userId);
  if (!current) throw new NotFoundError("We could not find that dream.");

  await inTransaction(async (tx) => {
    const keepHistory = current.contributionCount > 0 || current.fundedPaise > 0;
    if (keepHistory) await softDeleteDream(current.id, tx);
    else await hardDeleteDream(current.id, tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: keepHistory ? "dream.archived" : "dream.deleted",
      entityType: "Dream",
      entityId: current.id,
      metadata: { title: current.title },
    });
  });
  return { slug: wedding.slug };
}

/** Sets the display order. The list must contain exactly the couple's own dreams. */
export async function reorderDreams(actor: Actor, input: unknown): Promise<{ slug: string }> {
  const { ids } = reorderSchema.parse(input);
  const { wedding } = await requireOwnWedding(actor);
  const own = new Set((await listDreams(wedding.id)).map((dream) => dream.id));
  const valid =
    ids.length === own.size && new Set(ids).size === ids.length && ids.every((id) => own.has(id));
  if (!valid)
    throw new ValidationError("The list of dreams has changed. Please refresh and try again.");

  await inTransaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await setDisplayOrder(id, index, tx);
    }
  });
  return { slug: wedding.slug };
}
