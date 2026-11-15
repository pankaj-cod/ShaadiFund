import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEnv, isDemoPayments } from "@/lib/env";
import { WeddingView } from "@/components/wedding/wedding-view";
import { coupleNames } from "@/lib/format";
import { getCachedPublicWedding } from "@/lib/public-wedding";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const wedding = await getCachedPublicWedding(slug);
  if (!wedding) return { title: "Wedding not found", robots: { index: false, follow: false } };
  const names = coupleNames(wedding.partnerOneName, wedding.partnerTwoName);
  return {
    title: `${names}: our wedding wishlist`,
    description: `Celebrate with ${names} and help bring their dreams to life.`,
    robots: wedding.allowIndexing ? undefined : { index: false, follow: false },
    openGraph: {
      title: `${names}: our wedding wishlist`,
      images: wedding.heroImage ? [wedding.heroImage.url] : undefined,
    },
  };
}

async function Wedding({ params }: Props) {
  const { slug } = await params;
  const wedding = await getCachedPublicWedding(slug);
  if (!wedding) notFound();
  return <WeddingView wedding={wedding} demo={isDemoPayments(getEnv())} />;
}

export default function WeddingPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-svh flex-1" aria-busy="true" />}>
      <Wedding params={params} />
    </Suspense>
  );
}
