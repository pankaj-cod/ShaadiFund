"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  WAITLIST_ROLE_LABELS,
  WAITLIST_ROLES,
  waitlistInputSchema,
  type WaitlistInput,
} from "@/modules/waitlist/waitlist.schema";

export function WaitlistForm() {
  const [joined, setJoined] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistInputSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "COUPLE",
      weddingMonth: "",
      city: "",
      consent: false,
    },
  });
  const role = useWatch({ control, name: "role" });

  async function onSubmit(values: WaitlistInput) {
    setFormError(null);
    // A campaign tag in the page address (e.g. ?ref=instagram) is passed along.
    const source = new URLSearchParams(window.location.search).get("ref") ?? undefined;
    let response: Response;
    try {
      response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, source }),
      });
    } catch {
      setFormError("We could not reach the server. Please check your connection and try again.");
      return;
    }
    if (response.ok) {
      setJoined(true);
      return;
    }
    const json = (await response.json().catch(() => null)) as {
      error?: { message?: string; fields?: Record<string, string> };
    } | null;
    let placed = false;
    for (const [name, message] of Object.entries(json?.error?.fields ?? {})) {
      if (name in values) {
        setError(name as keyof WaitlistInput, { message });
        placed = true;
      }
    }
    if (!placed) {
      setFormError(
        response.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : (json?.error?.message ?? "Something went wrong. Please try again."),
      );
    }
  }

  if (joined) {
    return (
      <div role="status" className="bg-card text-foreground rounded-2xl border p-8 text-center">
        <MailCheck className="text-gold-ink mx-auto size-8" aria-hidden="true" />
        <p className="font-heading mt-4 text-3xl">You are on the list</p>
        <p className="text-muted-foreground mt-2">
          We will email you as soon as ShaadiFund opens. Meanwhile, the demo wedding shows what your
          page could look like.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Join the early-access list"
      className="bg-card text-foreground grid gap-5 rounded-2xl border p-6 text-left sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="waitlist-email" label="Email address" error={errors.email?.message}>
          <Input
            {...fieldAria("waitlist-email", errors.email?.message)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
          />
        </Field>
        <Field id="waitlist-name" label="Your name (optional)" error={errors.name?.message}>
          <Input
            {...fieldAria("waitlist-name", errors.name?.message)}
            autoComplete="name"
            {...register("name")}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="waitlist-role" label="I am…" error={errors.role?.message}>
          <Select {...fieldAria("waitlist-role", errors.role?.message)} {...register("role")}>
            {WAITLIST_ROLES.map((value) => (
              <option key={value} value={value}>
                {WAITLIST_ROLE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        {role === "COUPLE" ? (
          <Field
            id="waitlist-month"
            label="Wedding month (optional)"
            error={errors.weddingMonth?.message}
          >
            <Input
              {...fieldAria("waitlist-month", errors.weddingMonth?.message)}
              type="month"
              {...register("weddingMonth")}
            />
          </Field>
        ) : (
          <Field id="waitlist-city" label="City (optional)" error={errors.city?.message}>
            <Input
              {...fieldAria("waitlist-city", errors.city?.message)}
              autoComplete="address-level2"
              {...register("city")}
            />
          </Field>
        )}
      </div>
      {role === "COUPLE" ? (
        <Field id="waitlist-city" label="City (optional)" error={errors.city?.message}>
          <Input
            {...fieldAria("waitlist-city", errors.city?.message)}
            autoComplete="address-level2"
            {...register("city")}
          />
        </Field>
      ) : null}

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="accent-primary mt-0.5 size-4"
          aria-invalid={errors.consent ? true : undefined}
          {...register("consent")}
        />
        <span>
          Email me when ShaadiFund opens. I can ask to be removed at any time, and my details are
          used for nothing else.
        </span>
      </label>
      {errors.consent ? (
        <p role="alert" className="text-destructive -mt-3 text-sm">
          {errors.consent.message}
        </p>
      ) : null}
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <Button
        type="submit"
        size="lg"
        className="h-12 rounded-full text-base"
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? "Joining…" : "Join the early-access list"}
      </Button>
    </form>
  );
}
