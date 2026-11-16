import Link from "next/link";
import { DreamArt } from "@/components/dream/dream-art";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Button } from "@/components/ui/button";
import { FlipWords } from "@/components/ui/flip-words";
import { FundingProgress } from "@/components/ui/funding-progress";
import { TiltCard } from "@/components/ui/tilt-card";

const DREAMS = [
  "a week in the Swiss Alps",
  "sunrise in the Maldives",
  "their first car",
  "a kitchen they love",
  "a road trip through Ladakh",
] as const;

export function Hero() {
  return (
    <AuroraBackground className="h-auto min-h-svh px-6 pt-32 pb-20">
      <div className="max-w-page relative z-10 mx-auto grid w-full items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="text-center lg:text-left">
          <p className="eyebrow animate-rise">Wedding gifting, reimagined</p>
          <h1 className="text-display animate-rise mt-6 italic" style={{ animationDelay: "80ms" }}>
            Give them memories, not things.
          </h1>
          <p
            className="text-lead text-muted-foreground animate-rise mx-auto mt-7 max-w-xl lg:mx-0"
            style={{ animationDelay: "160ms" }}
          >
            Instead of another dinner set, help the couple live{" "}
            <FlipWords words={DREAMS} className="text-foreground font-medium" />
          </p>
          <div
            className="animate-rise mt-10 flex flex-wrap justify-center gap-3 lg:justify-start"
            style={{ animationDelay: "240ms" }}
          >
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
              <Link href="/sign-in">Create Your Wedding Wishlist</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-card/70 h-12 rounded-full px-7 text-base"
            >
              <Link href="/demo">Explore a Demo Wedding</Link>
            </Button>
          </div>
          <p
            className="text-muted-foreground animate-rise mt-5 text-sm"
            style={{ animationDelay: "320ms" }}
          >
            Free for couples. Guests give without creating an account.
          </p>
        </div>

        <div className="animate-rise mx-auto w-full max-w-sm" style={{ animationDelay: "280ms" }}>
          <TiltCard strength={18}>
            <figure className="bg-card shadow-lift overflow-hidden rounded-3xl border">
              <div className="relative aspect-[4/3]">
                <DreamArt category="HONEYMOON" />
                <span className="bg-card/90 absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-medium">
                  Sample dream
                </span>
              </div>
              <figcaption className="p-6">
                <p className="eyebrow">Honeymoon</p>
                <p className="font-heading mt-3 text-2xl">A week in the Swiss Alps</p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Train rides through the mountains and a first snowfall together.
                </p>
                <FundingProgress
                  className="mt-5"
                  label="A week in the Swiss Alps (sample)"
                  fundedPaise={18_750_000}
                  targetPaise={30_000_000}
                />
                <p className="text-muted-foreground mt-3 text-sm">23 guests have contributed</p>
              </figcaption>
            </figure>
          </TiltCard>
        </div>
      </div>
    </AuroraBackground>
  );
}
