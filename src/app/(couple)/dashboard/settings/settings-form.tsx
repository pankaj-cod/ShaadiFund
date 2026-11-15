"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { updateSettingsAction } from "@/app/(couple)/actions";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { ImageUpload } from "@/components/media/image-upload";
import { THEME_KEYS, THEMES } from "@/components/themes/themes";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { weddingSettingsSchema, type WeddingSettingsInput } from "@/modules/wedding/wedding.schema";
import type { ImageDTO, Workspace } from "@/modules/wedding/wedding.types";

const PRIVACY_OPTIONS = [
  ["showProgress", "Show funding progress", "Guests see how much of each dream is funded."],
  ["showGuestNames", "Show guest names", "Names of guests who contribute appear on your page."],
  [
    "showGuestMessages",
    "Show guest messages",
    "Messages guests mark as public appear on your page.",
  ],
  ["showAmounts", "Show individual amounts", "Each guest's amount is visible to other guests."],
  ["allowIndexing", "Allow search engines", "Let Google and others list your page."],
] as const;

export function SettingsForm({
  workspace,
  appHost,
}: {
  workspace: Workspace & { wedding: NonNullable<Workspace["wedding"]> };
  appHost: string;
}) {
  const { wedding, couple } = workspace;
  const [hero, setHero] = useState<ImageDTO | null>(wedding.heroImage);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WeddingSettingsInput>({
    resolver: zodResolver(weddingSettingsSchema),
    defaultValues: {
      partnerOneName: couple.partnerOneName ?? "",
      partnerTwoName: couple.partnerTwoName ?? "",
      slug: wedding.slug,
      weddingDate: wedding.weddingDate ?? "",
      venueName: wedding.venueName ?? "",
      city: wedding.city ?? "",
      welcomeMessage: wedding.welcomeMessage ?? "",
      thankYouMessage: wedding.thankYouMessage ?? "",
      theme: wedding.theme,
      showProgress: wedding.showProgress,
      showGuestNames: wedding.showGuestNames,
      showGuestMessages: wedding.showGuestMessages,
      showAmounts: wedding.showAmounts,
      allowIndexing: wedding.allowIndexing,
    },
  });

  async function onSubmit(values: WeddingSettingsInput) {
    setFormError(null);
    setSaved(false);
    const result = await updateSettingsAction(values);
    if (result.ok) {
      setSaved(true);
      reset(values);
      return;
    }
    let placed = false;
    for (const [name, message] of Object.entries(result.fields ?? {})) {
      if (name in values) {
        setError(name as keyof WeddingSettingsInput, { message });
        placed = true;
      }
    }
    if (!placed) setFormError(result.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-10">
      <fieldset className="grid gap-5">
        <legend className="text-h3 mb-4">The two of you</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="partnerOneName" label="Your name" error={errors.partnerOneName?.message}>
            <Input
              {...fieldAria("partnerOneName", errors.partnerOneName?.message)}
              {...register("partnerOneName")}
            />
          </Field>
          <Field
            id="partnerTwoName"
            label="Your partner's name"
            error={errors.partnerTwoName?.message}
          >
            <Input
              {...fieldAria("partnerTwoName", errors.partnerTwoName?.message)}
              {...register("partnerTwoName")}
            />
          </Field>
        </div>
        <ImageUpload
          kind="HERO"
          label="Cover photo"
          value={hero}
          onChange={setHero}
          allowRemove={false}
        />
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="text-h3 mb-4">The wedding</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="weddingDate" label="Wedding date" error={errors.weddingDate?.message}>
            <Input
              {...fieldAria("weddingDate", errors.weddingDate?.message)}
              type="date"
              {...register("weddingDate")}
            />
          </Field>
          <Field id="city" label="City" error={errors.city?.message}>
            <Input {...fieldAria("city", errors.city?.message)} {...register("city")} />
          </Field>
        </div>
        <Field id="venueName" label="Venue" error={errors.venueName?.message}>
          <Input
            {...fieldAria("venueName", errors.venueName?.message)}
            {...register("venueName")}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="text-h3 mb-4">Your page</legend>
        <Field
          id="slug"
          label="Page address"
          hint={`${appHost}/wedding/your-address. Changing it breaks links you have already shared.`}
          error={errors.slug?.message}
        >
          <Input
            {...fieldAria("slug", errors.slug?.message, "hint")}
            autoCapitalize="none"
            spellCheck={false}
            {...register("slug")}
          />
        </Field>
        <Field id="theme" label="Theme" error={errors.theme?.message}>
          <Select {...fieldAria("theme", errors.theme?.message)} {...register("theme")}>
            {THEME_KEYS.map((key) => (
              <option key={key} value={key}>
                {THEMES[key].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="welcomeMessage"
          label="Welcome message"
          hint="A few warm words for guests at the top of your page."
          error={errors.welcomeMessage?.message}
        >
          <Textarea
            {...fieldAria("welcomeMessage", errors.welcomeMessage?.message, "hint")}
            {...register("welcomeMessage")}
          />
        </Field>
        <Field
          id="thankYouMessage"
          label="Thank-you note"
          hint="Shown at the bottom of your page."
          error={errors.thankYouMessage?.message}
        >
          <Textarea
            {...fieldAria("thankYouMessage", errors.thankYouMessage?.message, "hint")}
            {...register("thankYouMessage")}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="text-h3 mb-4">Privacy</legend>
        {PRIVACY_OPTIONS.map(([name, label, detail]) => (
          <label key={name} className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="accent-primary mt-0.5 size-4" {...register(name)} />
            <span>
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground block">{detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      {saved ? <FormMessage tone="success">Your changes are saved.</FormMessage> : null}

      <div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
