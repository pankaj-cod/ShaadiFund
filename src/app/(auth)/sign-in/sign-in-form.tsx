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

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
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
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/dashboard" });
    if (error) {
      setFormError(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
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
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
        <Field
          id="email"
          label="Email address"
          hint="We will email you a link. No password needed."
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

      {googleEnabled ? (
        <>
          <div className="ornament-rule text-muted-foreground text-xs" aria-hidden="true">
            or
          </div>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={googlePending}
            onClick={async () => {
              setGooglePending(true);
              const { error } = await authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
              });
              if (error) {
                setFormError("We could not start Google sign-in. Please try again.");
                setGooglePending(false);
              }
            }}
          >
            Continue with Google
          </Button>
        </>
      ) : null}
    </div>
  );
}
