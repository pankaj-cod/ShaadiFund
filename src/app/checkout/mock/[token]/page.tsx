import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { getEnv } from "@/lib/env";
import { formatPaise } from "@/lib/money";
import { getGiftView } from "@/modules/contribution/contribution.service";
import { MockCheckout } from "./mock-checkout";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Demo payment",
  robots: { index: false, follow: false },
};

async function Checkout({ params }: Props) {
  if (getEnv().PAYMENTS_MODE !== "mock") return <NotFoundMessage />;
  const { token } = await params;
  const gift = await getGiftView(token);
  if (!gift || gift.provider !== "MOCK") return <NotFoundMessage />;
  if (gift.status === "CONFIRMED") redirect(`/gift/${token}`);

  return (
    <>
      <dl className="bg-card divide-y rounded-lg border text-sm">
        {[
          ["For", gift.coupleNames],
          ["Dream", gift.dreamTitle],
          ["Gift", formatPaise(gift.amountPaise)],
          ["Platform fee", formatPaise(gift.platformFeePaise)],
          ["Total", formatPaise(gift.totalPaise)],
        ].map(([term, value]) => (
          <div key={term} className="flex justify-between gap-6 px-5 py-3.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8">
        <MockCheckout
          contributionId={gift.contributionId}
          token={token}
          total={formatPaise(gift.totalPaise)}
        />
      </div>
    </>
  );
}

/** A stand-in for the payment provider's checkout. It exists only in demo mode. */
export default function MockCheckoutPage({ params }: Props) {
  return (
    <AppShell>
      <p className="eyebrow">Demo payment</p>
      <h1 className="text-h1 mt-4">This is not a real payment</h1>
      <p className="text-muted-foreground mt-3 mb-8">
        ShaadiFund is running in demo mode. No money will move and no payment details are collected.
        Choose an outcome to see what the guest would experience.
      </p>
      <Suspense fallback={<PageSkeleton />}>
        <Checkout params={params} />
      </Suspense>
    </AppShell>
  );
}
