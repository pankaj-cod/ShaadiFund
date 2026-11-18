import { coupleNames, formatCalendarDate } from "@/lib/format";
import { brandPreview, PREVIEW_SIZE, weddingPreview } from "@/lib/og/preview";
import { getCachedPublicWedding } from "@/lib/public-wedding";
import { stockPhotoUrl } from "@/lib/stock-photos";

export const alt = "A wedding wishlist on ShaadiFund";
export const size = PREVIEW_SIZE;
export const contentType = "image/png";

/**
 * The preview shown when a couple shares their page, usually on WhatsApp.
 * Built only from what the published page already shows guests; a draft,
 * hidden or unknown address gets the general ShaadiFund preview instead.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wedding = await getCachedPublicWedding(slug);
  if (!wedding) {
    return brandPreview({
      eyebrow: "Wedding gifting, reimagined",
      headline: "Give them memories, not things.",
      body: "A wedding page where guests help the couple live their dreams.",
      photoUrl: stockPhotoUrl("weddingCouple", 1200),
    });
  }
  return weddingPreview({
    names: coupleNames(wedding.partnerOneName, wedding.partnerTwoName),
    details: [
      wedding.weddingDate ? formatCalendarDate(wedding.weddingDate) : null,
      [wedding.venueName, wedding.city].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    photoUrl: wedding.heroImage?.url ?? null,
    footnote: "Our wedding wishlist · ShaadiFund",
  });
}
