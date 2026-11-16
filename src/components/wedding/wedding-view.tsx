import Image from "next/image";
import Link from "next/link";
import { DemoNotice } from "@/components/checkout/demo-notice";
import { DreamArt } from "@/components/dream/dream-art";
import { ThemeScope } from "@/components/themes/theme-scope";
import { Button } from "@/components/ui/button";
import { FundingProgress } from "@/components/ui/funding-progress";
import { TiltCard } from "@/components/ui/tilt-card";
import { coupleNames, formatCalendarDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { DREAM_CATEGORY_LABELS } from "@/modules/dream/dream.schema";
import type { PublicDream, PublicWedding } from "@/modules/wedding/wedding.types";

function Ornament() {
  return (
    <div className="ornament-rule mx-auto w-40" aria-hidden="true">
      <span className="bg-gold size-1.5 rotate-45" />
    </div>
  );
}

function Hero({ wedding }: { wedding: PublicWedding }) {
  const names = coupleNames(wedding.partnerOneName, wedding.partnerTwoName);
  const details = [
    wedding.weddingDate ? formatCalendarDate(wedding.weddingDate) : null,
    [wedding.venueName, wedding.city].filter(Boolean).join(", ") || null,
  ].filter(Boolean);

  if (wedding.heroImage) {
    return (
      <header className="relative isolate flex min-h-[78svh] items-end overflow-hidden">
        <Image
          src={wedding.heroImage.url}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        <div className="max-w-page mx-auto w-full px-6 pt-32 pb-14 text-white sm:pb-20">
          <p className="text-eyebrow animate-rise font-semibold uppercase opacity-90">
            The wedding of
          </p>
          <h1 className="text-display animate-rise mt-4 italic" style={{ animationDelay: "120ms" }}>
            {names}
          </h1>
          {details.length > 0 ? (
            <p
              className="text-lead animate-rise mt-5 opacity-95"
              style={{ animationDelay: "240ms" }}
            >
              {details.join(" · ")}
            </p>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header className="max-w-page mx-auto px-6 pt-24 pb-16 text-center sm:pt-32">
      <p className="eyebrow animate-rise">The wedding of</p>
      <h1 className="text-display animate-rise mt-6 italic" style={{ animationDelay: "120ms" }}>
        {names}
      </h1>
      {details.length > 0 ? (
        <p
          className="text-lead text-muted-foreground animate-rise mt-6"
          style={{ animationDelay: "240ms" }}
        >
          {details.join(" · ")}
        </p>
      ) : null}
      <div className="mt-12">
        <Ornament />
      </div>
    </header>
  );
}

function DreamCard({ dream, giveHref }: { dream: PublicDream; giveHref: string | null }) {
  return (
    <li className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
      <TiltCard>
        <article className="bg-card shadow-soft hover:shadow-lift flex h-full flex-col overflow-hidden rounded-2xl border transition-shadow duration-300">
          <div className="bg-accent relative aspect-[4/3]">
            {dream.coverImage ? (
              <Image
                src={dream.coverImage.url}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            ) : (
              <DreamArt category={dream.category} />
            )}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <p className="eyebrow">{DREAM_CATEGORY_LABELS[dream.category]}</p>
            <h3 className="text-h3 mt-3">{dream.title}</h3>
            <p className="text-muted-foreground mt-2 flex-1 leading-relaxed whitespace-pre-line">
              {dream.description}
            </p>
            <div className="mt-6">
              {dream.fundedPaise !== null ? (
                <FundingProgress
                  label={dream.title}
                  fundedPaise={dream.fundedPaise}
                  targetPaise={dream.targetPaise}
                />
              ) : (
                <p className="text-sm">
                  <span className="text-muted-foreground">A dream of </span>
                  <span className="font-medium">{formatPaise(dream.targetPaise)}</span>
                </p>
              )}
            </div>
            {giveHref ? (
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href={giveHref} aria-label={`Contribute to ${dream.title}`}>
                  Contribute
                </Link>
              </Button>
            ) : null}
          </div>
        </article>
      </TiltCard>
    </li>
  );
}

interface WeddingViewProps {
  wedding: PublicWedding;
  /** No contribute buttons: used for the couple's preview and the public demo. */
  preview?: boolean;
  /** Replaces the default preview notice. */
  banner?: string;
  /** Where the banner's "back" link goes, if anywhere. */
  backHref?: string;
  /** True while payments are not live. */
  demo: boolean;
}

/** The public wedding page. Receives only guest-safe data. */
export function WeddingView({
  wedding,
  preview = false,
  demo,
  banner,
  backHref,
}: WeddingViewProps) {
  return (
    <ThemeScope theme={wedding.theme} className="flex min-h-svh flex-1 flex-col">
      {preview ? (
        <p
          role="status"
          className="bg-primary text-primary-foreground px-6 py-2.5 text-center text-sm"
        >
          {banner ?? "Preview. This is how your page will look to guests."}
          {backHref ? (
            <>
              {" "}
              <Link href={backHref} className="underline underline-offset-4">
                Back to ShaadiFund
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <Hero wedding={wedding} />

      <main className="flex-1">
        {wedding.welcomeMessage ? (
          <section className="mx-auto max-w-prose px-6 py-16 text-center" aria-label="Welcome">
            <p className="font-heading text-h3 leading-relaxed whitespace-pre-line italic">
              {wedding.welcomeMessage}
            </p>
          </section>
        ) : null}

        <section className="max-w-page mx-auto px-6 py-16" aria-labelledby="dreams-heading">
          <div className="mx-auto max-w-prose text-center">
            <p className="eyebrow">Our wishlist</p>
            <h2 id="dreams-heading" className="text-h1 mt-4">
              Dreams we hope to live
            </h2>
            <p className="text-muted-foreground mt-4">
              Your presence is the greatest gift. If you would like to give something more, these
              are the memories we are hoping to make together.
            </p>
          </div>

          {wedding.dreams.length > 0 ? (
            <ul className="mt-12 flex flex-wrap justify-center gap-6">
              {wedding.dreams.map((dream) => (
                <DreamCard
                  key={dream.id}
                  dream={dream}
                  giveHref={preview ? null : `/wedding/${wedding.slug}/give/${dream.id}`}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-12 text-center">
              The couple is still putting their wishlist together. Please check back soon.
            </p>
          )}

          {demo && wedding.dreams.length > 0 ? (
            <DemoNotice className="mx-auto mt-10 max-w-md text-center" />
          ) : null}
        </section>

        {wedding.gifts.length > 0 ? (
          <section className="max-w-page mx-auto px-6 py-16" aria-labelledby="gifts-heading">
            <div className="text-center">
              <p className="eyebrow">With love</p>
              <h2 id="gifts-heading" className="text-h1 mt-4">
                From our guests
              </h2>
            </div>
            <ul className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              {wedding.gifts.map((gift, index) => (
                <li key={index} className="bg-card rounded-xl border p-6">
                  {gift.message ? (
                    <p className="font-heading text-xl leading-relaxed whitespace-pre-line italic">
                      {gift.message}
                    </p>
                  ) : null}
                  <p className={gift.message ? "mt-4 text-sm" : "text-sm"}>
                    <span className="font-medium">{gift.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      contributed
                      {gift.amountPaise !== null ? ` ${formatPaise(gift.amountPaise)}` : ""} to{" "}
                      {gift.dreamTitle}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {wedding.thankYouMessage ? (
          <section className="bg-secondary px-6 py-16 text-center" aria-label="Thank you">
            <div className="mx-auto max-w-prose">
              <Ornament />
              <p className="font-heading text-h3 mt-8 leading-relaxed whitespace-pre-line italic">
                {wedding.thankYouMessage}
              </p>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="text-muted-foreground px-6 py-10 text-center text-sm">
        Made with <span className="text-foreground font-medium">ShaadiFund</span>
      </footer>
    </ThemeScope>
  );
}
