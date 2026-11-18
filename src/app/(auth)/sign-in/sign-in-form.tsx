"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/modules/auth/auth-client";

const schema = z.object({
  email: z.email("Please enter a valid email address").trim().toLowerCase(),
});
type Values = z.infer<typeof schema>;

/** Google's "G" mark, drawn inline so no third-party image is loaded. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function SignInForm({
  googleEnabled,
  initialError,
}: {
  googleEnabled: boolean;
  /** A message to show on arrival, e.g. after a failed Google sign-in. */
  initialError?: string | null;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit({ email }: Values) {
    setFormError(null);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
      errorCallbackURL: "/sign-in",
    });
    if (error) {
      setFormError(
        error.status === 429
          ? "Too many sign-in emails for this address. Please wait 15 minutes and try again."
          : error.status === 503
            ? googleEnabled
              ? "We could not email you a sign-in link just now. Please continue with Google instead, or try again later."
              : "We could not email you a sign-in link just now. Please try again in a few minutes."
            : "We could not send your sign-in link. Please try again.",
      );
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div role="status" className="bg-card shadow-soft rounded-xl border p-8 text-center">
        <MailCheck className="text-gold-ink mx-auto size-8" aria-hidden="true" />
        <h2 className="text-h3 mt-4">Check your inbox</h2>
        <p className="text-muted-foreground mt-2">
          We sent a sign-in link to <span className="text-foreground font-medium">{sentTo}</span>.
          It works once and expires in 15 minutes.
        </p>
        <Button variant="ghost" className="mt-6" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {initialError ? <FormMessage tone="error">{initialError}</FormMessage> : null}

      {googleEnabled ? (
        <>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="bg-card h-12 text-base"
            disabled={googlePending}
            onClick={async () => {
              setGooglePending(true);
              setFormError(null);
              const { error } = await authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
                errorCallbackURL: "/sign-in",
              });
              if (error) {
                setFormError("We could not start Google sign-in. Please try again.");
                setGooglePending(false);
              }
            }}
          >
            {googlePending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </Button>
          <div className="ornament-rule text-muted-foreground text-xs" aria-hidden="true">
            or use your email
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
        <Field
          id="email"
          label="Email address"
          hint="We will email you a link that signs you in."
          error={errors.email?.message}
        >
          <Input
            {...fieldAria("email", errors.email?.message, "hint")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            {...register("email")}
          />
        </Field>
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Sending link…" : "Email me a sign-in link"}
        </Button>
      </form>
    </div>
  );
}
