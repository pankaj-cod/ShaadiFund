"use client";

import Image from "next/image";
import { WobbleCard } from "@/components/ui/wobble-card";
import { stockPhotoUrl, type StockPhotoKey } from "@/lib/stock-photos";

/** A photo filling the card, darkened on the reading side so the text stays legible. */
function CardPhoto({ photo, tint }: { photo: StockPhotoKey; tint: string }) {
  return (
    <>
      <Image
        src={stockPhotoUrl(photo, 1400)}
        alt=""
        fill
        unoptimized
        sizes="(max-width: 1024px) 100vw, 66vw"
        className="object-cover"
      />
      <div className={`absolute inset-0 ${tint}`} aria-hidden="true" />
    </>
  );
}

export function Audiences() {
  return (
    <section className="max-w-page mx-auto px-6 py-20" aria-labelledby="audiences-heading">
      <div className="mx-auto max-w-prose text-center">
        <p className="eyebrow">Made for both sides of the gift</p>
        <h2 id="audiences-heading" className="text-h1 mt-4">
          A better gift to give, and to receive
        </h2>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <WobbleCard containerClassName="bg-primary lg:col-span-2 min-h-[22rem]" className="py-12">
          <CardPhoto
            photo="festiveCouple"
            tint="bg-gradient-to-r from-[#1c1a17]/95 via-[#1c1a17]/75 to-[#1c1a17]/10"
          />
          <p className="text-eyebrow relative font-semibold tracking-[0.18em] text-[#e8c987] uppercase">
            For couples
          </p>
          <h3 className="font-heading text-primary-foreground relative mt-4 max-w-md text-3xl sm:text-4xl">
            Receive what you will actually remember
          </h3>
          <p className="text-primary-foreground/80 relative mt-4 max-w-md">
            No duplicate gifts, no awkward envelopes to track. One beautiful page, every message
            kept in one place, and a simple way to thank each person.
          </p>
        </WobbleCard>

        <WobbleCard containerClassName="bg-[#6b1a22] min-h-[22rem]" className="py-12">
          <CardPhoto
            photo="henna"
            tint="bg-gradient-to-t from-[#4a1016]/95 via-[#4a1016]/80 to-[#4a1016]/45"
          />
          <p className="text-eyebrow relative font-semibold tracking-[0.18em] text-[#e8c987] uppercase">
            For guests
          </p>
          <h3 className="font-heading relative mt-4 text-3xl text-[#fbefd9]">
            Give something that matters
          </h3>
          <p className="relative mt-4 text-[#fbefd9]/85">
            Choose the dream that feels like you, give any amount, and say it in your own words.
            Wherever in the world you are.
          </p>
        </WobbleCard>

        <WobbleCard containerClassName="bg-secondary lg:col-span-3 min-h-[14rem]" className="py-12">
          <p className="eyebrow">Why experiences</p>
          <h3 className="font-heading mt-4 max-w-2xl text-3xl">
            Things gather dust. A first snowfall together does not.
          </h3>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            Most couples already have what a home needs. What they are short of is time and
            adventures. ShaadiFund turns the goodwill of a wedding into moments they will keep
            talking about.
          </p>
        </WobbleCard>
      </div>
    </section>
  );
}
