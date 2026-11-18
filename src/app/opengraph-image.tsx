import { brandPreview, PREVIEW_SIZE } from "@/lib/og/preview";
import { stockPhotoUrl } from "@/lib/stock-photos";

export const alt = "ShaadiFund: give them memories, not things";
export const size = PREVIEW_SIZE;
export const contentType = "image/png";

/** The preview shown when someone shares the home page. */
export default function Image() {
  return brandPreview({
    eyebrow: "Wedding gifting, reimagined",
    headline: "Give them memories, not things.",
    body: "A wedding page where guests help the couple live their dreams, from a honeymoon to their first home.",
    photoUrl: stockPhotoUrl("weddingCouple", 1200),
  });
}
