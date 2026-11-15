import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { SignOutButton } from "@/components/couple/sign-out-button";
import { Button } from "@/components/ui/button";
import { getEnv } from "@/lib/env";
import { coupleNames } from "@/lib/format";
import { requireActorOrRedirect } from "@/modules/auth/session";
import { getWorkspace } from "@/modules/wedding/wedding.service";
import { DreamsManager } from "./dreams-manager";
import { ShareCard } from "./share-card";

export const metadata: Metadata = { title: "Dashboard" };

async function Dashboard() {
  const actor = await requireActorOrRedirect();
  const workspace = await getWorkspace(actor);
  if (!workspace.wedding || !workspace.couple.onboardingCompleted) redirect("/onboarding");

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="text-h1 mt-3 italic">
            {coupleNames(workspace.couple.partnerOneName, workspace.couple.partnerTwoName)}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/settings">Page settings</Link>
        </Button>
      </div>
      <ShareCard wedding={workspace.wedding} appUrl={getEnv().APP_URL} />
      <DreamsManager dreams={workspace.dreams} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell actions={<SignOutButton />} width="wide">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<PageSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
    </AppShell>
  );
}
