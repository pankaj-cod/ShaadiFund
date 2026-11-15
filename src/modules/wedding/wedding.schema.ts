import { z } from "zod";
import { THEME_KEYS } from "@/components/themes/themes";

/** Paths the app itself uses, which a couple may not claim as their URL. */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "demo",
  "design",
  "help",
  "legal",
  "new",
  "onboarding",
  "privacy",
  "sign-in",
  "sign-up",
  "support",
  "terms",
  "vowfund",
  "wedding",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(60, "Use at most 60 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens only")
  .refine((slug) => !RESERVED_SLUGS.has(slug), "That address is reserved, please pick another");

const personName = z
  .string()
  .trim()
  .min(1, "Please enter a name")
  .max(60, "Use at most 60 characters");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Please choose a valid date");

export const namesSchema = z.object({
  partnerOneName: personName,
  partnerTwoName: personName,
});
export type NamesInput = z.infer<typeof namesSchema>;

export const dateSchema = z.object({ weddingDate: isoDate });
export type DateInput = z.infer<typeof dateSchema>;

export const venueSchema = z.object({
  venueName: z.string().trim().min(2, "Please enter the venue").max(120),
  city: z.string().trim().min(2, "Please enter the city").max(80),
});
export type VenueInput = z.infer<typeof venueSchema>;

export const themeSchema = z.object({ theme: z.enum(THEME_KEYS) });
export type ThemeInput = z.infer<typeof themeSchema>;

/** Everything a couple can change about their page from the dashboard. Empty text clears a field. */
export const weddingSettingsSchema = z.object({
  partnerOneName: personName,
  partnerTwoName: personName,
  slug: slugSchema,
  weddingDate: z.union([isoDate, z.literal("")]),
  venueName: z.string().trim().max(120),
  city: z.string().trim().max(80),
  welcomeMessage: z.string().trim().max(600, "Use at most 600 characters"),
  thankYouMessage: z.string().trim().max(600, "Use at most 600 characters"),
  theme: z.enum(THEME_KEYS),
  showProgress: z.boolean(),
  showGuestNames: z.boolean(),
  showGuestMessages: z.boolean(),
  showAmounts: z.boolean(),
  allowIndexing: z.boolean(),
});
export type WeddingSettingsInput = z.infer<typeof weddingSettingsSchema>;

/** "Riya", "Rahul" -> "riya-and-rahul". Falls back to a neutral base for non-Latin names. */
export function slugify(partnerOne: string, partnerTwo: string): string {
  const clean = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [clean(partnerOne), clean(partnerTwo)].filter(Boolean);
  const base = parts.join("-and-").slice(0, 50).replace(/-+$/g, "");
  return base.length >= 3 && !RESERVED_SLUGS.has(base) ? base : "our-wedding";
}
