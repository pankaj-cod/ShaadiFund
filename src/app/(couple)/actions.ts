"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { weddingTag } from "@/lib/cache-tags";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireActor, type Actor } from "@/modules/auth/session";
import * as gifts from "@/modules/contribution/gifts.service";
import * as dreams from "@/modules/dream/dream.service";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import * as weddings from "@/modules/wedding/wedding.service";
import type { DreamDTO } from "@/modules/wedding/wedding.types";

/**
 * Server actions for the couple's onboarding and dashboard. Each one only
 * identifies the caller, calls one service function and refreshes what changed.
 * Validation, ownership checks and business rules all live in the services.
 */
async function run<T>(name: string, work: (actor: Actor) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await work(await requireActor());
    refresh();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message, fields: error.fields };
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
      return { ok: false, message: "Please check the highlighted fields.", fields };
    }
    logger.error("Server action failed", { action: name, error });
    return { ok: false, message: "Something went wrong on our side. Please try again." };
  }
}

/** Guests see changes immediately: expire the cached public page for this address. */
function expire(...slugs: string[]): void {
  for (const slug of new Set(slugs)) updateTag(weddingTag(slug));
}

export async function saveNamesAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  return run("saveNames", async (actor) => {
    const result = await weddings.saveNames(actor, input);
    expire(result.slug, ...result.replacedSlugs);
    return { slug: result.slug };
  });
}

export async function completePhotoStepAction(): Promise<ActionResult> {
  return run("completePhotoStep", async (actor) => {
    expire((await weddings.completePhotoStep(actor)).slug);
    return undefined;
  });
}

export async function saveWeddingDateAction(input: unknown): Promise<ActionResult> {
  return run("saveWeddingDate", async (actor) => {
    expire((await weddings.saveWeddingDate(actor, input)).slug);
    return undefined;
  });
}

export async function saveVenueAction(input: unknown): Promise<ActionResult> {
  return run("saveVenue", async (actor) => {
    expire((await weddings.saveVenue(actor, input)).slug);
    return undefined;
  });
}

export async function saveThemeAction(input: unknown): Promise<ActionResult> {
  return run("saveTheme", async (actor) => {
    expire((await weddings.saveTheme(actor, input)).slug);
    return undefined;
  });
}

export async function updateSettingsAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  return run("updateSettings", async (actor) => {
    const result = await weddings.updateSettings(actor, input);
    expire(result.slug, result.previousSlug);
    return { slug: result.slug };
  });
}

export async function publishWeddingAction(): Promise<ActionResult<{ slug: string }>> {
  return run("publishWedding", async (actor) => {
    const result = await weddings.publishWedding(actor);
    expire(result.slug);
    return result;
  });
}

export async function unpublishWeddingAction(): Promise<ActionResult> {
  return run("unpublishWedding", async (actor) => {
    expire((await weddings.unpublishWedding(actor)).slug);
    return undefined;
  });
}

export async function createDreamAction(input: unknown): Promise<ActionResult<DreamDTO>> {
  return run("createDream", async (actor) => {
    const result = await dreams.createDream(actor, input);
    expire(result.slug);
    return result.dream;
  });
}

export async function updateDreamAction(
  dreamId: string,
  input: unknown,
): Promise<ActionResult<DreamDTO>> {
  return run("updateDream", async (actor) => {
    const result = await dreams.updateDream(actor, dreamId, input);
    expire(result.slug);
    return result.dream;
  });
}

export async function deleteDreamAction(dreamId: string): Promise<ActionResult> {
  return run("deleteDream", async (actor) => {
    expire((await dreams.deleteDream(actor, dreamId)).slug);
    return undefined;
  });
}

export async function reorderDreamsAction(ids: string[]): Promise<ActionResult> {
  return run("reorderDreams", async (actor) => {
    expire((await dreams.reorderDreams(actor, { ids })).slug);
    return undefined;
  });
}

export async function setGiftMessageHiddenAction(
  contributionId: string,
  hidden: boolean,
): Promise<ActionResult> {
  return run("setGiftMessageHidden", async (actor) => {
    expire((await gifts.setGiftMessageHidden(actor, contributionId, hidden)).slug);
    return undefined;
  });
}

export async function sendThankYouAction(
  contributionId: string,
  input: unknown,
): Promise<ActionResult> {
  return run("sendThankYou", async (actor) => {
    await gifts.sendThankYou(actor, contributionId, input);
    after(() => dispatchNotifications());
    return undefined;
  });
}
