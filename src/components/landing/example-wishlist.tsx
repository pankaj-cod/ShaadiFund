import Image from "next/image";
import Link from "next/link";
import { DreamArt } from "@/components/dream/dream-art";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { FundingProgress } from "@/components/ui/funding-progress";
import { DEMO_WEDDING } from "@/lib/demo-wedding";
import { DREAM_CATEGORY_LABELS } from "@/modules/dream/dream.schema";

export function ExampleWishlist() {
  return (
    <section
      id="wishlist"
      className="max-w-page mx-auto scroll-mt-24 px-6 py-20"
      aria-labelledby="wishlist-heading"
    >
      <div className="mx-auto max-w-prose text-center">
        <p className="eyebrow">An example wishlist</p>
        <h2 id="wishlist-heading" className="text-h1 mt-4">
          What a couple&rsquo;s page might hold
        </h2>
        <p className="text-muted-foreground mt-4">
          Sample content, to show the idea. Guests can give any part of a dream, and several guests
          can share one.
        </p>
      </div>

      <BentoGrid className="mt-12 md:auto-rows-[21rem]">
        {DEMO_WEDDING.dreams.slice(0, 4).map((dream, index) => (
          <BentoGridItem
            key={dream.id}
            className={index === 0 || index === 3 ? "md:col-span-2" : undefined}
            header={
              <div className="relative min-h-28 flex-1 overflow-hidden rounded-lg">
                {dream.coverImage ? (
                  <Image
                    src={dream.coverImage.url}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="object-cover transition-transform duration-700 group-hover/bento:scale-[1.04]"
                  />
                ) : (
                  <DreamArt category={dream.category} />
                )}
              </div>
            }
            icon={<p className="eyebrow">{DREAM_CATEGORY_LABELS[dream.category]}</p>}
            title={dream.title}
            description={
              <FundingProgress
                className="mt-3"
                label={`${dream.title} (sample)`}
                fundedPaise={dream.fundedPaise ?? 0}
                targetPaise={dream.targetPaise}
              />
            }
          />
        ))}
      </BentoGrid>

      <div className="mt-10 text-center">
        <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-7 text-base">
          <Link href="/demo">See the full demo wedding</Link>
        </Button>
      </div>
    </section>
  );
}
