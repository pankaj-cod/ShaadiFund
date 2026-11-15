import "server-only";
import { inTransaction, isUniqueViolation } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.repository";
import { listConfirmedContributions } from "@/modules/contribution/contribution.repository";
import type { Actor } from "@/modules/auth/session";
import { updateCouple, type CoupleRecord } from "@/modules/couple/couple.repository";
import {
  advanceOnboarding,
  FIRST_ONBOARDING_STEP,
  getCoupleForActor,
} from "@/modules/couple/couple.service";
import { listDreams, type DreamRecord } from "@/modules/dream/dream.repository";
import {
  createWedding,
  findWeddingByCoupleId,
  findWeddingBySlug,
  slugExists,
  updateWedding,
  type WeddingRecord,
  type WeddingUpdate,
} from "./wedding.repository";
import {
  dateSchema,
  namesSchema,
  slugify,
  slugSchema,
  themeSchema,
  venueSchema,
  weddingSettingsSchema,
} from "./wedding.schema";
import type { DreamDTO, PublicGift, PublicWedding, WeddingDTO, Workspace } from "./wedding.types";

export const ONBOARDING_STEPS = {
  names: 2,
  photo: 3,
  date: 4,
  venue: 5,
  theme: 6,
  dream: 7,
  publish: 8,
} as const;

// ───────────────────────── Mapping ─────────────────────────

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toDreamDTO(dream: DreamRecord): DreamDTO {
  return {
    id: dream.id,
    title: dream.title,
    description: dream.description,
    category: dream.category,
    targetPaise: dream.targetPaise,
    fundedPaise: dream.fundedPaise,
    contributionCount: dream.contributionCount,
    isActive: dream.isActive,
    coverImage: dream.coverImage,
  };
}

function toWeddingDTO(wedding: WeddingRecord): WeddingDTO {
  return {
    id: wedding.id,
    slug: wedding.slug,
    status: wedding.status,
    theme: wedding.theme,
    weddingDate: toIsoDate(wedding.weddingDate),
    venueName: wedding.venueName,
    city: wedding.city,
    welcomeMessage: wedding.welcomeMessage,
    thankYouMessage: wedding.thankYouMessage,
    showProgress: wedding.showProgress,
    showGuestNames: wedding.showGuestNames,
    showGuestMessages: wedding.showGuestMessages,
    showAmounts: wedding.showAmounts,
    allowIndexing: wedding.allowIndexing,
    heroImage: wedding.heroImage,
  };
}

const PUBLIC_GIFT_LIMIT = 12;

type GiftRecord = Awaited<ReturnType<typeof listConfirmedContributions>>[number];

/**
 * Applies the couple's privacy settings and each guest's own choices.
 * Anonymous always wins; a message appears only if the guest made it public,
 * the couple has not hidden it, and the couple shows messages at all.
 */
export function toPublicGifts(
  privacy: Pick<WeddingRecord, "showGuestNames" | "showGuestMessages" | "showAmounts">,
  gifts: GiftRecord[],
): PublicGift[] {
  if (!privacy.showGuestNames && !privacy.showGuestMessages) return [];
  return gifts.map((gift) => {
    const messageVisible =
      privacy.showGuestMessages &&
      gift.message?.visibility === "PUBLIC" &&
      gift.message.moderation === "VISIBLE";
    return {
      name: gift.isAnonymous ? "Anonymous" : privacy.showGuestNames ? gift.guestName : "A guest",
      dreamTitle: gift.dream.title,
      message: messageVisible ? (gift.message?.body ?? null) : null,
      amountPaise: privacy.showAmounts ? gift.amountPaise : null,
    };
  });
}

/** The guest-facing view. Only active dreams, and progress only if the couple allows it. */
function toPublicWedding(
  wedding: WeddingRecord,
  dreams: DreamRecord[],
  gifts: GiftRecord[],
): PublicWedding {
  return {
    slug: wedding.slug,
    theme: wedding.theme,
    partnerOneName: wedding.couple.partnerOneName ?? "",
    partnerTwoName: wedding.couple.partnerTwoName ?? "",
    weddingDate: toIsoDate(wedding.weddingDate),
    venueName: wedding.venueName,
    city: wedding.city,
    welcomeMessage: wedding.welcomeMessage,
    thankYouMessage: wedding.thankYouMessage,
    heroImage: wedding.heroImage,
    allowIndexing: wedding.allowIndexing,
    dreams: dreams
      .filter((dream) => dream.isActive)
      .map((dream) => ({
        id: dream.id,
        title: dream.title,
        description: dream.description,
        category: dream.category,
        targetPaise: dream.targetPaise,
        fundedPaise: wedding.showProgress ? dream.fundedPaise : null,
        contributionCount: wedding.showProgress ? dream.contributionCount : null,
        coverImage: dream.coverImage,
      })),
    gifts: toPublicGifts(wedding, gifts),
  };
}

async function loadPublicWedding(wedding: WeddingRecord): Promise<PublicWedding> {
  const [dreams, gifts] = await Promise.all([
    listDreams(wedding.id),
    listConfirmedContributions(wedding.id, PUBLIC_GIFT_LIMIT),
  ]);
  return toPublicWedding(wedding, dreams, gifts);
}

// ───────────────────────── Reads ─────────────────────────

/** Everything the signed-in couple's dashboard and onboarding need. */
export async function getWorkspace(actor: Actor): Promise<Workspace> {
  const couple = await getCoupleForActor(actor);
  const wedding = await findWeddingByCoupleId(couple.id);
  const dreams = wedding ? await listDreams(wedding.id) : [];
  return {
    couple: {
      partnerOneName: couple.partnerOneName,
      partnerTwoName: couple.partnerTwoName,
      onboardingStep: Math.max(FIRST_ONBOARDING_STEP, couple.onboardingStep),
      onboardingCompleted: couple.onboardingCompletedAt !== null,
    },
    wedding: wedding ? toWeddingDTO(wedding) : null,
    dreams: dreams.map(toDreamDTO),
  };
}

/** A published wedding by its public address, or null. Drafts and suspended pages are invisible. */
export async function getPublicWedding(slug: string): Promise<PublicWedding | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const wedding = await findWeddingBySlug(parsed.data);
  if (!wedding || wedding.status !== "PUBLISHED") return null;
  return loadPublicWedding(wedding);
}

/** The couple's own page exactly as guests would see it, whatever its status. */
export async function getPreviewWedding(actor: Actor): Promise<PublicWedding | null> {
  const couple = await getCoupleForActor(actor);
  const wedding = await findWeddingByCoupleId(couple.id);
  if (!wedding) return null;
  return loadPublicWedding(wedding);
}

/** The actor's couple and wedding; ownership is established here for every mutation. */
export async function requireOwnWedding(
  actor: Actor,
): Promise<{ couple: CoupleRecord; wedding: WeddingRecord }> {
  const couple = await getCoupleForActor(actor);
  const wedding = await findWeddingByCoupleId(couple.id);
  if (!wedding) throw new NotFoundError("Please add your names first to create your wedding page.");
  return { couple, wedding };
}

// ───────────────────────── Onboarding steps ─────────────────────────

async function findFreeSlug(base: string): Promise<string> {
  if (!(await slugExists(base))) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await slugExists(candidate))) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Step 2. Saves both names and creates the wedding (with its address) the first time.
 * While the page is still an unpublished draft using the address we generated,
 * correcting a name also corrects the address.
 */
export async function saveNames(
  actor: Actor,
  input: unknown,
): Promise<{ slug: string; replacedSlugs: string[] }> {
  const names = namesSchema.parse(input);
  const couple = await getCoupleForActor(actor);
  const existing = await findWeddingByCoupleId(couple.id);

  const wanted = slugify(names.partnerOneName, names.partnerTwoName);
  const previousAuto = slugify(couple.partnerOneName ?? "", couple.partnerTwoName ?? "");
  const stillAutoDraft =
    existing?.status === "DRAFT" &&
    existing.publishedAt === null &&
    existing.slug.startsWith(previousAuto) &&
    wanted !== previousAuto;
  const slug = !existing || stillAutoDraft ? await findFreeSlug(wanted) : existing.slug;

  await inTransaction(async (tx) => {
    await updateCouple(couple.id, names, tx);
    if (!existing) {
      const wedding = await createWedding(couple.id, slug, tx);
      await recordAudit(tx, {
        actorUserId: actor.userId,
        action: "wedding.created",
        entityType: "Wedding",
        entityId: wedding.id,
        metadata: { slug },
      });
    } else if (slug !== existing.slug) {
      await updateWedding(existing.id, { slug }, tx);
    }
    await advanceOnboarding(couple, ONBOARDING_STEPS.names, tx);
  });
  return { slug, replacedSlugs: existing && existing.slug !== slug ? [existing.slug] : [] };
}

async function patchOwnWedding(
  actor: Actor,
  patch: WeddingUpdate,
  completedStep: number,
): Promise<{ slug: string }> {
  const { couple, wedding } = await requireOwnWedding(actor);
  await inTransaction(async (tx) => {
    await updateWedding(wedding.id, patch, tx);
    await advanceOnboarding(couple, completedStep, tx);
  });
  return { slug: wedding.slug };
}

/** Step 3 is optional; this records that the couple has moved past it. */
export async function completePhotoStep(actor: Actor): Promise<{ slug: string }> {
  return patchOwnWedding(actor, {}, ONBOARDING_STEPS.photo);
}

/** Step 4. */
export async function saveWeddingDate(actor: Actor, input: unknown): Promise<{ slug: string }> {
  const { weddingDate } = dateSchema.parse(input);
  return patchOwnWedding(actor, { weddingDate: fromIsoDate(weddingDate) }, ONBOARDING_STEPS.date);
}

/** Step 5. */
export async function saveVenue(actor: Actor, input: unknown): Promise<{ slug: string }> {
  return patchOwnWedding(actor, venueSchema.parse(input), ONBOARDING_STEPS.venue);
}

/** Step 6. */
export async function saveTheme(actor: Actor, input: unknown): Promise<{ slug: string }> {
  return patchOwnWedding(actor, themeSchema.parse(input), ONBOARDING_STEPS.theme);
}

// ───────────────────────── Settings ─────────────────────────

const emptyToNull = (value: string): string | null => (value === "" ? null : value);

/** Dashboard settings. Returns both addresses so the caller can refresh each cached page. */
export async function updateSettings(
  actor: Actor,
  input: unknown,
): Promise<{ slug: string; previousSlug: string }> {
  const settings = weddingSettingsSchema.parse(input);
  const { couple, wedding } = await requireOwnWedding(actor);

  if (settings.slug !== wedding.slug && (await slugExists(settings.slug))) {
    throw new ValidationError(undefined, { slug: "That address is already taken" });
  }

  try {
    await inTransaction(async (tx) => {
      await updateCouple(
        couple.id,
        { partnerOneName: settings.partnerOneName, partnerTwoName: settings.partnerTwoName },
        tx,
      );
      await updateWedding(
        wedding.id,
        {
          slug: settings.slug,
          theme: settings.theme,
          weddingDate: settings.weddingDate === "" ? null : fromIsoDate(settings.weddingDate),
          venueName: emptyToNull(settings.venueName),
          city: emptyToNull(settings.city),
          welcomeMessage: emptyToNull(settings.welcomeMessage),
          thankYouMessage: emptyToNull(settings.thankYouMessage),
          showProgress: settings.showProgress,
          showGuestNames: settings.showGuestNames,
          showGuestMessages: settings.showGuestMessages,
          showAmounts: settings.showAmounts,
          allowIndexing: settings.allowIndexing,
        },
        tx,
      );
      await recordAudit(tx, {
        actorUserId: actor.userId,
        action: "wedding.settings_updated",
        entityType: "Wedding",
        entityId: wedding.id,
        metadata:
          settings.slug === wedding.slug ? undefined : { from: wedding.slug, to: settings.slug },
      });
    });
  } catch (error) {
    // Someone else claimed the address between our check and the write.
    if (isUniqueViolation(error, "slug")) {
      throw new ValidationError(undefined, { slug: "That address is already taken" });
    }
    throw error;
  }
  return { slug: settings.slug, previousSlug: wedding.slug };
}

// ───────────────────────── Publishing ─────────────────────────

/** Reasons a page cannot be published yet, in plain language. Empty means ready. */
export function publishBlockers(input: {
  partnerOneName: string | null;
  partnerTwoName: string | null;
  activeDreamCount: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.partnerOneName?.trim() || !input.partnerTwoName?.trim()) {
    blockers.push("Add both of your names.");
  }
  if (input.activeDreamCount < 1) {
    blockers.push("Add at least one dream that is open for contributions.");
  }
  return blockers;
}

export async function publishWedding(actor: Actor): Promise<{ slug: string }> {
  const { couple, wedding } = await requireOwnWedding(actor);
  if (wedding.status === "SUSPENDED") {
    throw new ConflictError("This page has been paused by VowFund. Please contact support.");
  }
  const dreams = await listDreams(wedding.id);
  const blockers = publishBlockers({
    partnerOneName: couple.partnerOneName,
    partnerTwoName: couple.partnerTwoName,
    activeDreamCount: dreams.filter((dream) => dream.isActive).length,
  });
  if (blockers.length > 0) throw new ValidationError(blockers.join(" "));

  await inTransaction(async (tx) => {
    await updateWedding(
      wedding.id,
      { status: "PUBLISHED", publishedAt: wedding.publishedAt ?? new Date() },
      tx,
    );
    await updateCouple(
      couple.id,
      {
        onboardingStep: ONBOARDING_STEPS.publish,
        onboardingCompletedAt: couple.onboardingCompletedAt ?? new Date(),
      },
      tx,
    );
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: "wedding.published",
      entityType: "Wedding",
      entityId: wedding.id,
    });
  });
  return { slug: wedding.slug };
}

export async function unpublishWedding(actor: Actor): Promise<{ slug: string }> {
  const { wedding } = await requireOwnWedding(actor);
  if (wedding.status !== "PUBLISHED") return { slug: wedding.slug };
  await inTransaction(async (tx) => {
    await updateWedding(wedding.id, { status: "UNPUBLISHED" }, tx);
    await recordAudit(tx, {
      actorUserId: actor.userId,
      action: "wedding.unpublished",
      entityType: "Wedding",
      entityId: wedding.id,
    });
  });
  return { slug: wedding.slug };
}
