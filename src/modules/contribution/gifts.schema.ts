import { z } from "zod";

export const thankYouSchema = z.object({
  note: z
    .string()
    .trim()
    .min(2, "Write a few words for your guest")
    .max(600, "Use at most 600 characters"),
});
export type ThankYouInput = z.infer<typeof thankYouSchema>;

/** One paid gift as the couple sees it. Includes details other guests never see. */
export interface CoupleGift {
  id: string;
  status: "CONFIRMED" | "REFUNDED";
  guestName: string;
  guestEmail: string;
  isAnonymous: boolean;
  amountPaise: number;
  /** ISO timestamp. */
  receivedAt: string;
  dreamTitle: string;
  message: { body: string; isPrivate: boolean; isHidden: boolean } | null;
  thankYouNote: string | null;
}

export interface CoupleGiftsPage {
  gifts: CoupleGift[];
  nextCursor: string | null;
  summary: { totalPaise: number; count: number };
}
