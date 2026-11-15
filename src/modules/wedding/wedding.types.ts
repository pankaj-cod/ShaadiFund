import type { ThemeKey } from "@/components/themes/themes";
import type { DreamCategory } from "@/modules/dream/dream.schema";

/** Plain, serialisable shapes passed from services to pages and client components. */

export interface ImageDTO {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface DreamDTO {
  id: string;
  title: string;
  description: string;
  category: DreamCategory;
  targetPaise: number;
  fundedPaise: number;
  contributionCount: number;
  isActive: boolean;
  coverImage: ImageDTO | null;
}

export type WeddingStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "SUSPENDED";

export interface WeddingDTO {
  id: string;
  slug: string;
  status: WeddingStatus;
  theme: ThemeKey;
  /** YYYY-MM-DD */
  weddingDate: string | null;
  venueName: string | null;
  city: string | null;
  welcomeMessage: string | null;
  thankYouMessage: string | null;
  showProgress: boolean;
  showGuestNames: boolean;
  showGuestMessages: boolean;
  showAmounts: boolean;
  allowIndexing: boolean;
  heroImage: ImageDTO | null;
}

export interface Workspace {
  couple: {
    partnerOneName: string | null;
    partnerTwoName: string | null;
    /** Furthest onboarding step reached (2 to 8; step 1 is creating the account). */
    onboardingStep: number;
    onboardingCompleted: boolean;
  };
  wedding: WeddingDTO | null;
  dreams: DreamDTO[];
}

/** What a guest may see. Built field by field so nothing private can leak by accident. */
export interface PublicDream {
  id: string;
  title: string;
  description: string;
  category: DreamCategory;
  targetPaise: number;
  /** Null when the couple has chosen to hide progress. */
  fundedPaise: number | null;
  contributionCount: number | null;
  coverImage: ImageDTO | null;
}

export interface PublicWedding {
  slug: string;
  theme: ThemeKey;
  partnerOneName: string;
  partnerTwoName: string;
  weddingDate: string | null;
  venueName: string | null;
  city: string | null;
  welcomeMessage: string | null;
  thankYouMessage: string | null;
  heroImage: ImageDTO | null;
  allowIndexing: boolean;
  dreams: PublicDream[];
  /** Recent confirmed gifts, already filtered by the couple's privacy settings. */
  gifts: PublicGift[];
}

export interface PublicGift {
  /** The guest's name, "Anonymous", or "A guest" when names are hidden. */
  name: string;
  dreamTitle: string;
  message: string | null;
  amountPaise: number | null;
}
