import { z } from "zod";
import { emailField } from "@/lib/email-field";
import { DEFAULT_LIMITS, PAISE_PER_RUPEE } from "@/lib/money";

/** Checkout settings. Defaults live here; an admin screen will make them editable. */
export const CONTRIBUTION_CONFIG = {
  /** 250 = 2.5%. A placeholder until the founder decides the fee model. */
  feeBasisPoints: 250,
  minRupees: DEFAULT_LIMITS.minContributionPaise / PAISE_PER_RUPEE,
  maxRupees: DEFAULT_LIMITS.maxContributionPaise / PAISE_PER_RUPEE,
  suggestedRupees: [1_100, 2_100, 5_100, 11_000],
} as const;

export const MESSAGE_VISIBILITIES = ["PUBLIC", "COUPLE_ONLY"] as const;

export const contributionInputSchema = z.object({
  dreamId: z.uuid(),
  amountRupees: z
    .number({ error: "Enter an amount in rupees" })
    .int("Use whole rupees")
    .min(CONTRIBUTION_CONFIG.minRupees, `The minimum gift is ₹${CONTRIBUTION_CONFIG.minRupees}`)
    .max(CONTRIBUTION_CONFIG.maxRupees, "The maximum gift is ₹5,00,000"),
  guestName: z
    .string()
    .trim()
    .min(2, "Please enter your name")
    .max(80, "Use at most 80 characters"),
  guestEmail: emailField(),
  isAnonymous: z.boolean(),
  message: z.string().trim().max(500, "Use at most 500 characters"),
  messageVisibility: z.enum(MESSAGE_VISIBILITIES),
  consent: z.boolean().refine((value) => value === true, "Please confirm to continue"),
  /** Generated once per checkout form, so pressing Pay twice creates one contribution. */
  idempotencyKey: z.uuid(),
});
export type ContributionInput = z.infer<typeof contributionInputSchema>;
