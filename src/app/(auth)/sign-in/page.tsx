import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { isGoogleSignInEnabled } from "@/modules/auth/auth";
import { getActor } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

async function SignIn() {
  if (await getActor()) redirect("/dashboard");
  return <SignInForm googleEnabled={isGoogleSignInEnabled()} />;
}

export default function SignInPage() {
  return (
    <AppShell glow>
      <p className="eyebrow">Welcome</p>
      <h1 className="text-h1 mt-4">Create your wedding wishlist</h1>
      <p className="text-muted-foreground mt-3 mb-8">
        Sign in or create your account with your email. New here? The same link sets you up.
      </p>
      <Suspense fallback={<PageSkeleton />}>
        <SignIn />
      </Suspense>
    </AppShell>
  );
}
