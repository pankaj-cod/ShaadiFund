import { DEMO_WEDDING } from "@/lib/demo-wedding";
import { coupleNames, formatCalendarDate } from "@/lib/format";
import { weddingPreview, PREVIEW_SIZE } from "@/lib/og/preview";

export const alt = "A sample ShaadiFund wedding page";
export const size = PREVIEW_SIZE;
export const contentType = "image/png";

/** The preview shown when someone shares the demo wedding. */
export default function Image() {
  const wedding = DEMO_WEDDING;
  return weddingPreview({
    names: coupleNames(wedding.partnerOneName, wedding.partnerTwoName),
    details: [
      wedding.weddingDate ? formatCalendarDate(wedding.weddingDate) : null,
      [wedding.venueName, wedding.city].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    photoUrl: wedding.heroImage?.url ?? null,
    footnote: "A sample wedding page on ShaadiFund",
  });
}
