// Adapted from Aceternity UI's "Infinite Moving Cards" (https://ui.aceternity.com), restyled for ShaadiFund.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface MovingCard {
  quote: string;
  name: string;
  title: string;
}

const DURATIONS = { fast: "30s", normal: "55s", slow: "90s" } as const;

/**
 * A row of quote cards that drifts sideways forever and pauses on hover.
 * The list is rendered twice so the loop is seamless; the copy is hidden from
 * screen readers. The animation stops for people who prefer reduced motion.
 */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "slow",
  className,
}: {
  items: MovingCard[];
  direction?: "left" | "right";
  speed?: keyof typeof DURATIONS;
  className?: string;
}) {
  const style = {
    "--animation-duration": DURATIONS[speed],
    "--animation-direction": direction === "left" ? "forwards" : "reverse",
  } as CSSProperties;

  const renderCards = (hidden: boolean) =>
    items.map((item) => (
      <li
        key={`${hidden ? "copy" : "card"}-${item.name}`}
        aria-hidden={hidden || undefined}
        className="bg-card w-[320px] max-w-full shrink-0 rounded-2xl border px-7 py-6 md:w-[420px]"
      >
        <blockquote>
          <p className="font-heading text-xl leading-relaxed italic">{item.quote}</p>
          <footer className="text-muted-foreground mt-5 text-sm leading-relaxed">
            <span className="text-foreground block font-medium">{item.name}</span>
            {item.title}
          </footer>
        </blockquote>
      </li>
    ));

  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]",
        className,
      )}
    >
      <ul className="animate-scroll flex w-max shrink-0 flex-nowrap gap-4 py-4 hover:[animation-play-state:paused] motion-reduce:animate-none">
        {renderCards(false)}
        {renderCards(true)}
      </ul>
    </div>
  );
}
