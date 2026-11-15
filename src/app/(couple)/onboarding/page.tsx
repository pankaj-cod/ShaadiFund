import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { SignOutButton } from "@/components/couple/sign-out-button";
import { getEnv } from "@/lib/env";
import { requireActorOrRedirect } from "@/modules/auth/session";
import { getWorkspace } from "@/modules/wedding/wedding.service";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Set up your wedding page" };

async function Onboarding() {
  const actor = await requireActorOrRedirect();
  const workspace = await getWorkspace(actor);
  if (workspace.couple.onboardingCompleted) redirect("/dashboard");
  return <OnboardingWizard workspace={workspace} appUrl={getEnv().APP_URL} />;
}

export default function OnboardingPage() {
  return (
    <AppShell actions={<SignOutButton />}>
      <Suspense fallback={<PageSkeleton />}>
        <Onboarding />
      </Suspense>
    </AppShell>
  );
}
