import { z } from "zod";
import { DEFAULT_LIMITS, PAISE_PER_RUPEE } from "@/lib/money";

export const DREAM_CATEGORIES = [
  "HONEYMOON",
  "TRAVEL",
  "EXPERIENCES",
  "HOME",
  "LIFESTYLE",
  "ADVENTURES",
  "OTHER",
] as const;
export type DreamCategory = (typeof DREAM_CATEGORIES)[number];

export const DREAM_CATEGORY_LABELS: Record<DreamCategory, string> = {
  HONEYMOON: "Honeymoon",
  TRAVEL: "Travel",
  EXPERIENCES: "Experiences",
  HOME: "Home",
  LIFESTYLE: "Lifestyle",
  ADVENTURES: "Adventures",
  OTHER: "Other dreams",
};

export const MIN_DREAM_TARGET_RUPEES = 1_000;
export const MAX_DREAM_TARGET_RUPEES = DEFAULT_LIMITS.maxDreamTargetPaise / PAISE_PER_RUPEE;
export const MAX_DREAMS_PER_WEDDING = 30;

export const dreamInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give this dream a short title")
    .max(80, "Use at most 80 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Tell your guests a little about this dream")
    .max(600, "Use at most 600 characters"),
  category: z.enum(DREAM_CATEGORIES),
  targetRupees: z
    .number({ error: "Enter an amount in rupees" })
    .int("Use whole rupees")
    .min(
      MIN_DREAM_TARGET_RUPEES,
      `The target must be at least ₹${MIN_DREAM_TARGET_RUPEES.toLocaleString("en-IN")}`,
    )
    .max(MAX_DREAM_TARGET_RUPEES, "The target can be at most ₹1 crore"),
  coverImageId: z.uuid().nullable(),
  isActive: z.boolean(),
});
export type DreamInput = z.infer<typeof dreamInputSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_DREAMS_PER_WEDDING),
});
