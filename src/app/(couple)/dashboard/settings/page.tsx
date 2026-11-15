import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { SignOutButton } from "@/components/couple/sign-out-button";
import { getEnv } from "@/lib/env";
import { requireActorOrRedirect } from "@/modules/auth/session";
import { getWorkspace } from "@/modules/wedding/wedding.service";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Page settings" };

async function Settings() {
  const actor = await requireActorOrRedirect();
  const workspace = await getWorkspace(actor);
  const { wedding } = workspace;
  if (!wedding) redirect("/onboarding");
  return (
    <SettingsForm
      workspace={{ ...workspace, wedding }}
      appHost={getEnv().APP_URL.replace(/^https?:\/\//, "")}
    />
  );
}

export default function SettingsPage() {
  return (
    <AppShell actions={<SignOutButton />} width="wide">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
        <h1 className="text-h1 mt-4 mb-10">Page settings</h1>
        <Suspense fallback={<PageSkeleton />}>
          <Settings />
        </Suspense>
      </div>
    </AppShell>
  );
}
