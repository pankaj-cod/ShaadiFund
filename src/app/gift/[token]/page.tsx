import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoNotice } from "@/components/checkout/demo-notice";
import { ThemeScope } from "@/components/themes/theme-scope";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { getGiftView } from "@/modules/contribution/contribution.service";
import type { GiftView } from "@/modules/contribution/contribution.types";
import { GiftPending } from "./gift-pending";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Your gift",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Confirmed({ gift }: { gift: GiftView }) {
  return (
    <article className="text-center">
      <p className="eyebrow">Gift confirmed</p>
      <h1 className="text-display mt-5 italic">Thank you, {gift.guestName}</h1>
      <div className="ornament-rule mx-auto mt-8 w-40" aria-hidden="true">
        <span className="bg-gold size-1.5 rotate-45" />
      </div>
      <p className="text-lead text-muted-foreground mx-auto mt-8 max-w-md">
        You have helped {gift.coupleNames} move closer to{" "}
        <span className="text-foreground font-medium">{gift.dreamTitle}</span>.
      </p>

      {gift.message ? (
        <blockquote className="bg-card shadow-soft mx-auto mt-10 max-w-md rounded-xl border p-6 text-left">
          <p className="eyebrow">Your message</p>
          <p className="font-heading mt-3 text-xl leading-relaxed whitespace-pre-line italic">
            {gift.message}
          </p>
        </blockquote>
      ) : null}

      {gift.coupleReply ? (
        <blockquote className="bg-secondary mx-auto mt-6 max-w-md rounded-xl p-6 text-left">
          <p className="eyebrow">A note from {gift.coupleNames}</p>
          <p className="font-heading mt-3 text-xl leading-relaxed whitespace-pre-line italic">
            {gift.coupleReply}
          </p>
        </blockquote>
      ) : null}

      <dl className="bg-card mx-auto mt-10 max-w-md divide-y rounded-lg border text-left text-sm">
        {[
          ["Your gift", formatPaise(gift.amountPaise)],
          ["Platform fee", formatPaise(gift.platformFeePaise)],
          ["Total paid", formatPaise(gift.totalPaise)],
        ].map(([term, value]) => (
          <div key={term} className="flex justify-between gap-6 px-5 py-3.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground mx-auto mt-4 max-w-md text-sm">
        A confirmation has been sent to your email. Keep this link to come back to this page.
      </p>
      <Button asChild size="lg" variant="outline" className="mt-8">
        <Link href={`/wedding/${gift.slug}`}>Back to {gift.coupleNames}</Link>
      </Button>
    </article>
  );
}

function NotCompleted({ gift }: { gift: GiftView }) {
  const failed = gift.status === "FAILED";
  return (
    <div className="text-center">
      <p className="eyebrow">{failed ? "Payment not completed" : "Checkout closed"}</p>
      <h1 className="text-h1 mt-5">
        {failed ? "Your payment did not go through" : "This checkout has expired"}
      </h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-md">
        {failed
          ? "Nothing has been added to the couple's wishlist. If money left your account it is normally returned by your bank within a few working days; write to support@vowfund.in if it is not."
          : "No payment was made. You can start again whenever you like."}
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href={`/wedding/${gift.slug}/give/${gift.dreamId}`}>Try again</Link>
      </Button>
    </div>
  );
}

async function Gift({ params }: Props) {
  const { token } = await params;
  const gift = await getGiftView(token);
  if (!gift) {
    return (
      <NotFoundMessage
        title="We could not find that gift"
        detail="Please use the link from your confirmation email."
      />
    );
  }

  return (
    <ThemeScope theme={gift.theme} className="flex min-h-svh flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:py-20">
        {gift.demo ? <DemoNotice className="mx-auto mb-10 max-w-md" /> : null}
        {gift.status === "CONFIRMED" || gift.status === "REFUNDED" ? (
          <Confirmed gift={gift} />
        ) : gift.status === "PENDING" ? (
          <GiftPending contributionId={gift.contributionId} token={token} />
        ) : (
          <NotCompleted gift={gift} />
        )}
      </main>
    </ThemeScope>
  );
}

/** The guest's private acknowledgment page. Never cached, never indexed. */
export default function GiftPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-svh flex-1" aria-busy="true" />}>
      <Gift params={params} />
    </Suspense>
  );
}
