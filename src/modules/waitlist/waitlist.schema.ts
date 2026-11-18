import { z } from "zod";
import { emailField } from "@/lib/email-field";

export const WAITLIST_ROLES = ["COUPLE", "GUEST", "PLANNER", "OTHER"] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number];

export const WAITLIST_ROLE_LABELS: Record<WaitlistRole, string> = {
  COUPLE: "Planning our wedding",
  GUEST: "Going to a wedding",
  PLANNER: "A wedding planner or vendor",
  OTHER: "Just curious",
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

export const waitlistInputSchema = z
  .object({
    email: emailField(),
    name: optionalText(80, "Use at most 80 characters"),
    role: z.enum(WAITLIST_ROLES, { error: "Please choose one" }),
    weddingMonth: z
      .union([z.literal(""), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Please choose a month")])
      .optional()
      .transform((value) => (value ? value : undefined)),
    city: optionalText(80, "Use at most 80 characters"),
    consent: z.boolean().refine((value) => value, "Please confirm so we can email you"),
    /** Campaign tag from the page address (?ref=…). Anything unexpected becomes "home". */
    source: z
      .string()
      .optional()
      .transform((value) =>
        value && /^[a-z0-9_-]{1,40}$/i.test(value) ? value.toLowerCase() : "home",
      ),
  })
  // A wedding month only means something for couples.
  .transform((input) => ({
    ...input,
    weddingMonth: input.role === "COUPLE" ? input.weddingMonth : undefined,
  }));

export type WaitlistInput = z.input<typeof waitlistInputSchema>;
export type WaitlistData = z.output<typeof waitlistInputSchema>;
