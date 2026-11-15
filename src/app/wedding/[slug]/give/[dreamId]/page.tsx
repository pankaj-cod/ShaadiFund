import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { ThemeScope } from "@/components/themes/theme-scope";
import { getEnv, isDemoPayments } from "@/lib/env";
import { coupleNames } from "@/lib/format";
import { getCachedPublicWedding } from "@/lib/public-wedding";
import { DREAM_CATEGORY_LABELS } from "@/modules/dream/dream.schema";

type Props = { params: Promise<{ slug: string; dreamId: string }> };

export const metadata: Metadata = {
  title: "Contribute to a dream",
  robots: { index: false, follow: false },
};

async function Checkout({ params }: Props) {
  const { slug, dreamId } = await params;
  const wedding = await getCachedPublicWedding(slug);
  const dream = wedding?.dreams.find((candidate) => candidate.id === dreamId);
  if (!wedding || !dream) notFound();
  const names = coupleNames(wedding.partnerOneName, wedding.partnerTwoName);

  return (
    <ThemeScope theme={wedding.theme} className="flex min-h-svh flex-1 flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10 sm:py-14">
        <Link
          href={`/wedding/${wedding.slug}`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to {names}
        </Link>
        <p className="eyebrow mt-8">{DREAM_CATEGORY_LABELS[dream.category]}</p>
        <h1 className="text-h1 mt-3">{dream.title}</h1>
        <p className="text-muted-foreground mt-3 mb-10 leading-relaxed">{dream.description}</p>
        <CheckoutForm
          slug={wedding.slug}
          dreamId={dream.id}
          dreamTitle={dream.title}
          coupleNames={names}
          demo={isDemoPayments(getEnv())}
        />
      </main>
    </ThemeScope>
  );
}

export default function GivePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-svh flex-1" aria-busy="true" />}>
      <Checkout params={params} />
    </Suspense>
  );
}
