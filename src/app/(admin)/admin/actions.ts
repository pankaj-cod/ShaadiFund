"use server";

import { refresh, updateTag } from "next/cache";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { weddingTag } from "@/lib/cache-tags";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import * as admin from "@/modules/admin/admin.service";
import { requireActor, type Actor } from "@/modules/auth/session";

/** Admin actions. Each service function re-checks the admin role itself. */
async function run(
  name: string,
  work: (actor: Actor) => Promise<{ slug: string }>,
): Promise<ActionResult> {
  try {
    const { slug } = await work(await requireActor());
    updateTag(weddingTag(slug));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof AppError)
      return { ok: false, message: error.message, fields: error.fields };
    if (error instanceof ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Please check your input." };
    }
    logger.error("Admin action failed", { action: name, error });
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

export async function suspendWeddingAction(
  weddingId: string,
  reason: string,
): Promise<ActionResult> {
  return run("suspendWedding", (actor) => admin.suspendWedding(actor, weddingId, { reason }));
}

export async function restoreWeddingAction(weddingId: string): Promise<ActionResult> {
  return run("restoreWedding", (actor) => admin.restoreWedding(actor, weddingId));
}

export async function refundPaymentAction(
  paymentId: string,
  reason: string,
): Promise<ActionResult> {
  return run("refundPayment", (actor) => admin.refundAsAdmin(actor, paymentId, { reason }));
}
