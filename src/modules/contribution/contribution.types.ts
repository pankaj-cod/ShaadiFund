import type { ThemeKey } from "@/components/themes/themes";

/** Returned when a guest starts checkout: what to pay and with which provider. */
export interface CheckoutSession {
  contributionId: string;
  acknowledgmentToken: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED" | "REFUNDED";
  amountPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  payment: {
    provider: "MOCK" | "RAZORPAY";
    mode: "TEST" | "LIVE";
    orderId: string;
    /** The provider's publishable key for opening its checkout. Null for the mock. */
    publicKey: string | null;
  };
}

/** The guest's own view of their gift, reached with their private link. */
export interface GiftView {
  contributionId: string;
  status: CheckoutSession["status"];
  guestName: string;
  coupleNames: string;
  slug: string;
  theme: ThemeKey;
  dreamId: string;
  dreamTitle: string;
  amountPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  message: string | null;
  coupleReply: string | null;
  provider: "MOCK" | "RAZORPAY" | null;
  /** True whenever no real money moved. */
  demo: boolean;
}
