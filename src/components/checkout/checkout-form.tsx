"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { DemoNotice } from "@/components/checkout/demo-notice";
import { openRazorpayCheckout } from "@/components/checkout/razorpay-checkout";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { calculateContributionTotals, formatPaise, PAISE_PER_RUPEE } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  CONTRIBUTION_CONFIG,
  contributionInputSchema,
  type ContributionInput,
} from "@/modules/contribution/contribution.schema";
import type { CheckoutSession } from "@/modules/contribution/contribution.types";

interface CheckoutFormProps {
  slug: string;
  dreamId: string;
  dreamTitle: string;
  coupleNames: string;
  demo: boolean;
}

export function CheckoutForm({ slug, dreamId, dreamTitle, coupleNames, demo }: CheckoutFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // One key per form: pressing the button twice can never create two gifts.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContributionInput>({
    resolver: zodResolver(contributionInputSchema),
    defaultValues: {
      dreamId,
      amountRupees: CONTRIBUTION_CONFIG.suggestedRupees[1],
      guestName: "",
      guestEmail: "",
      isAnonymous: false,
      message: "",
      messageVisibility: "PUBLIC",
      consent: false,
      idempotencyKey,
    },
  });

  const amountRupees = useWatch({ control, name: "amountRupees" });
  const validAmount =
    Number.isInteger(amountRupees) &&
    amountRupees >= CONTRIBUTION_CONFIG.minRupees &&
    amountRupees <= CONTRIBUTION_CONFIG.maxRupees;
  const totals = validAmount
    ? calculateContributionTotals(
        amountRupees * PAISE_PER_RUPEE,
        CONTRIBUTION_CONFIG.feeBasisPoints,
      )
    : null;

  async function onSubmit(values: ContributionInput) {
    setFormError(null);
    let response: Response;
    try {
      response = await fetch(`/api/weddings/${slug}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setFormError("We could not reach the server. Nothing was charged. Please try again.");
      return;
    }
    const json = (await response.json().catch(() => null)) as
      | { data: CheckoutSession }
      | { error: { message: string; fields?: Record<string, string> } }
      | null;

    if (!response.ok || !json || "error" in json) {
      const error = json && "error" in json ? json.error : null;
      let placed = false;
      for (const [name, message] of Object.entries(error?.fields ?? {})) {
        if (name in values) {
          setError(name as keyof ContributionInput, { message });
          placed = true;
        }
      }
      if (!placed) setFormError(error?.message ?? "Something went wrong. Nothing was charged.");
      return;
    }

    const session = json.data;
    const giftUrl = `/gift/${session.acknowledgmentToken}`;
    if (session.status !== "PENDING" && session.status !== "FAILED") {
      router.push(giftUrl);
      return;
    }
    if (session.payment.provider === "MOCK") {
      router.push(`/checkout/mock/${session.acknowledgmentToken}`);
      return;
    }
    if (!session.payment.publicKey) {
      setFormError("Payments are not available right now. Nothing was charged.");
      return;
    }

    let result;
    try {
      result = await openRazorpayCheckout({
        key: session.payment.publicKey,
        orderId: session.payment.orderId,
        amountPaise: session.totalPaise,
        description: `Gift for ${coupleNames}: ${dreamTitle}`.slice(0, 250),
        guestName: values.guestName,
        guestEmail: values.guestEmail,
      });
    } catch {
      setFormError("We could not open the payment window. Nothing was charged. Please try again.");
      return;
    }
    if (result.outcome === "closed") {
      setFormError(
        result.attempted
          ? "That payment did not go through and your gift has not been counted. You can try again."
          : "You closed the payment window before paying. Nothing was charged.",
      );
      return;
    }

    // Our server verifies the result with Razorpay; the browser's word alone is never enough.
    // If this request is lost, the confirmation page keeps checking and the gift is still found.
    try {
      await fetch(`/api/contributions/${session.contributionId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session.acknowledgmentToken,
          providerOrderId: result.response.razorpay_order_id,
          providerPaymentId: result.response.razorpay_payment_id,
          signature: result.response.razorpay_signature,
        }),
      });
    } catch {
      // Fall through to the confirmation page, which polls for the outcome.
    }
    router.push(giftUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-8">
      {demo ? <DemoNotice /> : null}

      <fieldset className="grid gap-4">
        <legend className="text-h3 mb-4">Your gift</legend>
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          role="group"
          aria-label="Suggested amounts"
        >
          {CONTRIBUTION_CONFIG.suggestedRupees.map((rupees) => (
            <button
              key={rupees}
              type="button"
              aria-pressed={amountRupees === rupees}
              onClick={() => setValue("amountRupees", rupees, { shouldValidate: true })}
              className={cn(
                "bg-card h-12 rounded-md border text-base font-medium transition-colors",
                amountRupees === rupees
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:border-primary",
              )}
            >
              {formatPaise(rupees * PAISE_PER_RUPEE)}
            </button>
          ))}
        </div>
        <Field
          id="amountRupees"
          label="Or enter an amount (₹)"
          hint={`Between ${formatPaise(CONTRIBUTION_CONFIG.minRupees * PAISE_PER_RUPEE)} and ${formatPaise(CONTRIBUTION_CONFIG.maxRupees * PAISE_PER_RUPEE)}.`}
          error={errors.amountRupees?.message}
        >
          <Input
            {...fieldAria("amountRupees", errors.amountRupees?.message, "hint")}
            type="number"
            inputMode="numeric"
            min={CONTRIBUTION_CONFIG.minRupees}
            max={CONTRIBUTION_CONFIG.maxRupees}
            step={1}
            {...register("amountRupees", { valueAsNumber: true })}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="text-h3 mb-4">Your details</legend>
        <Field id="guestName" label="Your name" error={errors.guestName?.message}>
          <Input
            {...fieldAria("guestName", errors.guestName?.message)}
            autoComplete="name"
            {...register("guestName")}
          />
        </Field>
        <Field
          id="guestEmail"
          label="Email address"
          hint="Only for your confirmation. The couple can see it; other guests cannot."
          error={errors.guestEmail?.message}
        >
          <Input
            {...fieldAria("guestEmail", errors.guestEmail?.message, "hint")}
            type="email"
            inputMode="email"
            autoComplete="email"
            {...register("guestEmail")}
          />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-4"
            {...register("isAnonymous")}
          />
          <span>
            <span className="font-medium">Give anonymously</span>
            <span className="text-muted-foreground block">
              Other guests will not see your name. {coupleNames} will still know it was you.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="text-h3 mb-4">A message for the couple</legend>
        <Field id="message" label="Your message (optional)" error={errors.message?.message}>
          <Textarea
            {...fieldAria("message", errors.message?.message)}
            placeholder="Wishing you both a lifetime of adventures…"
            {...register("message")}
          />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-4"
            onChange={(event) =>
              setValue("messageVisibility", event.target.checked ? "COUPLE_ONLY" : "PUBLIC")
            }
          />
          <span>
            <span className="font-medium">Keep my message private</span>
            <span className="text-muted-foreground block">Only the couple will read it.</span>
          </span>
        </label>
      </fieldset>

      <section
        className="bg-card shadow-soft rounded-xl border p-6"
        aria-labelledby="summary-heading"
      >
        <h2 id="summary-heading" className="text-h3">
          Summary
        </h2>
        <dl className="mt-4 grid gap-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Dream</dt>
            <dd className="text-right font-medium">{dreamTitle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">For</dt>
            <dd className="text-right font-medium">{coupleNames}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Your gift</dt>
            <dd className="font-medium tabular-nums">
              {totals ? formatPaise(totals.amountPaise) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              Platform fee ({CONTRIBUTION_CONFIG.feeBasisPoints / 100}%)
            </dt>
            <dd className="tabular-nums">{totals ? formatPaise(totals.platformFeePaise) : "—"}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-4 border-t pt-3 text-base">
            <dt className="font-medium">Total to pay</dt>
            <dd className="font-semibold tabular-nums" data-testid="total-payable">
              {totals ? formatPaise(totals.totalPaise) : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-4 text-sm">
          The full gift amount goes towards the couple&rsquo;s dream; the fee is added on top. Gifts
          are final once paid. If a payment fails or is taken twice, write to{" "}
          <a className="underline underline-offset-4" href="mailto:support@shaadifund.in">
            support@shaadifund.in
          </a>{" "}
          and we will put it right.
        </p>
      </section>

      <div className="grid gap-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-4"
            aria-invalid={errors.consent ? true : undefined}
            {...register("consent")}
          />
          <span>
            I agree that ShaadiFund may use my name, email and message to process this gift and
            share them with {coupleNames}.
          </span>
        </label>
        {errors.consent ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.consent.message}
          </p>
        ) : null}
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Lock aria-hidden="true" />
          )}
          {isSubmitting
            ? "Starting payment…"
            : totals
              ? `Continue to pay ${formatPaise(totals.totalPaise)}`
              : "Continue to payment"}
        </Button>
      </div>
    </form>
  );
}
