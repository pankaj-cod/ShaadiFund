import "server-only";
import { isUniqueViolation, type Db } from "@/lib/db";
import type { Actor } from "@/modules/auth/session";
import {
  createCoupleForUser,
  findCoupleByUserId,
  updateCouple,
  type CoupleRecord,
} from "./couple.repository";

export const FIRST_ONBOARDING_STEP = 2;
export const LAST_ONBOARDING_STEP = 8;

/** The actor's couple, created on first use. Safe if two requests race. */
export async function getCoupleForActor(actor: Actor): Promise<CoupleRecord> {
  const existing = await findCoupleByUserId(actor.userId);
  if (existing) return existing;
  try {
    return await createCoupleForUser(actor.userId);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const created = await findCoupleByUserId(actor.userId);
    if (!created) throw error;
    return created;
  }
}

/** Records that a step is done. Progress only ever moves forward. */
export async function advanceOnboarding(
  couple: Pick<CoupleRecord, "id" | "onboardingStep">,
  completedStep: number,
  db?: Db,
): Promise<void> {
  const next = Math.min(LAST_ONBOARDING_STEP, completedStep + 1);
  if (next > couple.onboardingStep) {
    await updateCouple(couple.id, { onboardingStep: next }, db);
  }
}
