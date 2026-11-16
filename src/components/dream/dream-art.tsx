import {
  Armchair,
  Compass,
  Gem,
  MountainSnow,
  Palmtree,
  Sparkles,
  Tent,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DreamCategory } from "@/modules/dream/dream.schema";

/** Artwork shown when a dream has no photo: a soft wash of colour and a line drawing per category. */
const ART: Record<DreamCategory, { icon: LucideIcon; wash: string }> = {
  HONEYMOON: { icon: MountainSnow, wash: "from-[#f3e2c6] via-[#efe6d6] to-[#dfe6e4]" },
  TRAVEL: { icon: Palmtree, wash: "from-[#f6dfc9] via-[#f3e6cf] to-[#e3ead8]" },
  EXPERIENCES: { icon: Sparkles, wash: "from-[#f1dfe0] via-[#f3e8dc] to-[#efe0c4]" },
  HOME: { icon: Armchair, wash: "from-[#ece3d2] via-[#f2ead9] to-[#e4dccb]" },
  LIFESTYLE: { icon: Gem, wash: "from-[#e9e2d6] via-[#f1e9da] to-[#e6d7b8]" },
  ADVENTURES: { icon: Tent, wash: "from-[#e2e8d7] via-[#efe8d4] to-[#f0dcbc]" },
  OTHER: { icon: Compass, wash: "from-[#efe4d0] via-[#f3ebdc] to-[#e9dcc5]" },
};

export function DreamArt({ category, className }: { category: DreamCategory; className?: string }) {
  const { icon: Icon, wash } = ART[category];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br",
        wash,
        className,
      )}
    >
      <div className="absolute inset-0 [background:radial-gradient(60%_60%_at_70%_20%,rgb(255_255_255/0.55),transparent_70%)]" />
      <Icon className="relative size-16 text-[#8a6a2b]/55" strokeWidth={1} />
    </div>
  );
}
