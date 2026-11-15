import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getEnv, isDemoPayments } from "@/lib/env";
import { WeddingView } from "@/components/wedding/wedding-view";
import { requireActorOrRedirect } from "@/modules/auth/session";
import { getPreviewWedding } from "@/modules/wedding/wedding.service";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

async function Preview() {
  const actor = await requireActorOrRedirect();
  const wedding = await getPreviewWedding(actor);
  if (!wedding) redirect("/onboarding");
  return <WeddingView wedding={wedding} preview demo={isDemoPayments(getEnv())} />;
}

/** The couple's own page as guests will see it, available before publishing. */
export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-svh flex-1" aria-busy="true" />}>
      <Preview />
    </Suspense>
  );
}
