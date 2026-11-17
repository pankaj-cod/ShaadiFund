import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { isGoogleSignInEnabled } from "@/modules/auth/auth";
import { getActor } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ error?: string }> };

/** Plain-language versions of the errors the sign-in providers can send back. */
function signInErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "access_denied")
    return "Google sign-in was cancelled. You can try again, or use your email.";
  if (code === "email_not_found" || code === "email_is_missing") {
    return "Google did not share an email address with us, so we could not sign you in. Please use your email instead.";
  }
  if (code === "account_not_linked") {
    return "An account with this email already exists but has not been verified. Sign in with your email link first, then Google will work too.";
  }
  if (code === "INVALID_TOKEN" || code === "EXPIRED_TOKEN") {
    return "That sign-in link has expired or was already used. Please ask for a new one.";
  }
  return "We could not sign you in. Please try again.";
}

async function SignIn({ searchParams }: Props) {
  if (await getActor()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <SignInForm googleEnabled={isGoogleSignInEnabled()} initialError={signInErrorMessage(error)} />
  );
}

export default function SignInPage({ searchParams }: Props) {
  return (
    <AppShell glow>
      <p className="eyebrow">Welcome</p>
      <h1 className="text-h1 mt-4">Create your wedding wishlist</h1>
      <p className="text-muted-foreground mt-3 mb-8">
        New here or coming back, it is the same simple step. No password needed.
      </p>
      <Suspense fallback={<PageSkeleton />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}
