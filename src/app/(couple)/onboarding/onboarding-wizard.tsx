"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import type { z } from "zod";
import {
  completePhotoStepAction,
  publishWeddingAction,
  saveNamesAction,
  saveThemeAction,
  saveVenueAction,
  saveWeddingDateAction,
} from "@/app/(couple)/actions";
import { DreamForm } from "@/components/dream/dream-form";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { ImageUpload } from "@/components/media/image-upload";
import { ThemeScope } from "@/components/themes/theme-scope";
import { THEME_KEYS, THEMES, type ThemeKey } from "@/components/themes/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { coupleNames, formatCalendarDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { dateSchema, namesSchema, venueSchema } from "@/modules/wedding/wedding.schema";
import type { ImageDTO, Workspace } from "@/modules/wedding/wedding.types";

const FIRST_STEP = 2;
const LAST_STEP = 8;
const STEP_TITLES: Record<number, string> = {
  2: "Who is getting married?",
  3: "Add a photo of you both",
  4: "When is the wedding?",
  5: "Where is it happening?",
  6: "Choose a look for your page",
  7: "Add your first dream",
  8: "Preview and publish",
};

interface StepProps {
  workspace: Workspace;
  onDone: () => void;
}

// ───────────────────────── Shared pieces ─────────────────────────

function SubmitRow({
  pending,
  label = "Save and continue",
  saved,
  children,
}: {
  pending: boolean;
  label?: string;
  saved?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Saving…" : label}
      </Button>
      {children}
      <span role="status" className="text-muted-foreground text-sm">
        {saved && !pending ? "Saved" : ""}
      </span>
    </div>
  );
}

/**
 * A step made of plain text fields. Saves when the couple continues, and also
 * quietly whenever they leave a field with everything valid (autosave).
 */
function useStepForm<T extends FieldValues>(
  schema: z.ZodType<T, T>,
  defaultValues: DefaultValues<T>,
  save: (values: T) => Promise<ActionResult<unknown>>,
  onDone: () => void,
) {
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues, mode: "onTouched" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function persist(values: T): Promise<boolean> {
    setFormError(null);
    const result = await save(values);
    if (result.ok) {
      setSaved(true);
      form.reset(values);
      return true;
    }
    let placed = false;
    for (const [name, message] of Object.entries(result.fields ?? {})) {
      if (name in values) {
        form.setError(name as Path<T>, { message });
        placed = true;
      }
    }
    if (!placed) setFormError(result.message);
    return false;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (await persist(values)) onDone();
  });

  /** Autosave: only when something changed and the whole step is valid. */
  async function onBlur() {
    if (!form.formState.isDirty || form.formState.isSubmitting) return;
    const parsed = schema.safeParse(form.getValues());
    if (parsed.success) await persist(parsed.data);
  }

  return { form, onSubmit, onBlur, formError, saved };
}

// ───────────────────────── Steps ─────────────────────────

function NamesStep({ workspace, onDone }: StepProps) {
  const { form, onSubmit, onBlur, formError, saved } = useStepForm(
    namesSchema,
    {
      partnerOneName: workspace.couple.partnerOneName ?? "",
      partnerTwoName: workspace.couple.partnerTwoName ?? "",
    },
    saveNamesAction,
    onDone,
  );
  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={onSubmit} onBlur={onBlur} noValidate className="grid gap-5">
      <Field id="partnerOneName" label="Your name" error={errors.partnerOneName?.message}>
        <Input
          {...fieldAria("partnerOneName", errors.partnerOneName?.message)}
          autoComplete="given-name"
          placeholder="Riya"
          {...form.register("partnerOneName")}
        />
      </Field>
      <Field id="partnerTwoName" label="Your partner's name" error={errors.partnerTwoName?.message}>
        <Input
          {...fieldAria("partnerTwoName", errors.partnerTwoName?.message)}
          autoComplete="off"
          placeholder="Rahul"
          {...form.register("partnerTwoName")}
        />
      </Field>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <SubmitRow pending={isSubmitting} saved={saved} />
    </form>
  );
}

function PhotoStep({ workspace, onDone }: StepProps) {
  const [photo, setPhoto] = useState<ImageDTO | null>(workspace.wedding?.heroImage ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await completePhotoStepAction();
        setPending(false);
        if (result.ok) onDone();
        else setError(result.message);
      }}
    >
      <ImageUpload
        kind="HERO"
        label="Cover photo"
        value={photo}
        onChange={setPhoto}
        allowRemove={false}
      />
      <p className="text-muted-foreground text-sm">
        This is the first thing your guests see. You can add or change it later.
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <SubmitRow pending={pending} label={photo ? "Continue" : "Skip for now"} />
    </form>
  );
}

function DateStep({ workspace, onDone }: StepProps) {
  const { form, onSubmit, onBlur, formError, saved } = useStepForm(
    dateSchema,
    { weddingDate: workspace.wedding?.weddingDate ?? "" },
    saveWeddingDateAction,
    onDone,
  );
  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={onSubmit} onBlur={onBlur} noValidate className="grid gap-5">
      <Field id="weddingDate" label="Wedding date" error={errors.weddingDate?.message}>
        <Input
          {...fieldAria("weddingDate", errors.weddingDate?.message)}
          type="date"
          {...form.register("weddingDate")}
        />
      </Field>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <SubmitRow pending={isSubmitting} saved={saved} />
    </form>
  );
}

function VenueStep({ workspace, onDone }: StepProps) {
  const { form, onSubmit, onBlur, formError, saved } = useStepForm(
    venueSchema,
    { venueName: workspace.wedding?.venueName ?? "", city: workspace.wedding?.city ?? "" },
    saveVenueAction,
    onDone,
  );
  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={onSubmit} onBlur={onBlur} noValidate className="grid gap-5">
      <Field id="venueName" label="Venue" error={errors.venueName?.message}>
        <Input
          {...fieldAria("venueName", errors.venueName?.message)}
          placeholder="The Leela Palace"
          {...form.register("venueName")}
        />
      </Field>
      <Field id="city" label="City" error={errors.city?.message}>
        <Input
          {...fieldAria("city", errors.city?.message)}
          autoComplete="address-level2"
          placeholder="Udaipur"
          {...form.register("city")}
        />
      </Field>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <SubmitRow pending={isSubmitting} saved={saved} />
    </form>
  );
}

function ThemeStep({ workspace, onDone }: StepProps) {
  const [theme, setTheme] = useState<ThemeKey>(workspace.wedding?.theme ?? "MINIMAL_IVORY");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = coupleNames(workspace.couple.partnerOneName, workspace.couple.partnerTwoName);
  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await saveThemeAction({ theme });
        setPending(false);
        if (result.ok) onDone();
        else setError(result.message);
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="sr-only">Page theme</legend>
        {THEME_KEYS.map((key) => (
          <label
            key={key}
            className={cn(
              "block cursor-pointer overflow-hidden rounded-lg border-2 transition-colors",
              "has-[:focus-visible]:ring-ring/40 has-[:focus-visible]:ring-[3px]",
              theme === key ? "border-primary" : "border-border hover:border-input",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={key}
              checked={theme === key}
              onChange={() => setTheme(key)}
              className="sr-only"
            />
            <ThemeScope theme={key} className="px-5 py-6 text-center">
              <p className="eyebrow">The wedding of</p>
              <p className="font-heading mt-2 text-3xl italic">{names}</p>
              <span className="bg-gold mx-auto mt-4 block h-px w-16" />
            </ThemeScope>
            <span className="bg-card flex items-center justify-between gap-3 border-t px-5 py-3 text-sm">
              <span>
                <span className="font-medium">{THEMES[key].name}</span>
                <span className="text-muted-foreground block">{THEMES[key].description}</span>
              </span>
              {theme === key ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
            </span>
          </label>
        ))}
      </fieldset>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <SubmitRow pending={pending} />
    </form>
  );
}

function DreamStep({ workspace, onDone }: StepProps) {
  if (workspace.dreams.length > 0) {
    return (
      <div className="grid gap-5">
        <ul className="grid gap-3">
          {workspace.dreams.map((dream) => (
            <li key={dream.id} className="bg-card rounded-lg border px-5 py-4">
              <p className="font-medium">{dream.title}</p>
              <p className="text-muted-foreground text-sm">
                Target {formatPaise(dream.targetPaise)}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-sm">
          You can add more dreams and edit these from your dashboard after publishing.
        </p>
        <div>
          <Button size="lg" onClick={onDone}>
            Continue
          </Button>
        </div>
      </div>
    );
  }
  return <DreamForm submitLabel="Save and continue" onSaved={onDone} />;
}

function PublishStep({ workspace, appUrl }: { workspace: Workspace; appUrl: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { wedding, couple, dreams } = workspace;
  const address = `${appUrl.replace(/^https?:\/\//, "")}/wedding/${wedding?.slug ?? ""}`;

  const summary: [string, string][] = [
    ["Couple", coupleNames(couple.partnerOneName, couple.partnerTwoName)],
    ["Date", wedding?.weddingDate ? formatCalendarDate(wedding.weddingDate) : "Not set"],
    ["Venue", [wedding?.venueName, wedding?.city].filter(Boolean).join(", ") || "Not set"],
    ["Theme", wedding ? THEMES[wedding.theme].name : "Not set"],
    ["Dreams", `${dreams.length}`],
    ["Page address", address],
  ];

  return (
    <div className="grid gap-6">
      <dl className="bg-card divide-y rounded-lg border">
        {summary.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-6 px-5 py-3.5 text-sm">
            <dt className="text-muted-foreground shrink-0">{term}</dt>
            <dd className="text-right font-medium break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-sm">
        Once published, anyone with the link can see your page. You can unpublish it at any time,
        and you can change the address in settings.
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await publishWeddingAction();
            if (result.ok) {
              // The dashboard shows the live page and its share link.
              router.push("/dashboard");
              return;
            }
            setPending(false);
            setError(result.message);
          }}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {pending ? "Publishing…" : "Publish my page"}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard/preview" target="_blank">
            Preview first
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Wizard ─────────────────────────

export function OnboardingWizard({ workspace, appUrl }: { workspace: Workspace; appUrl: string }) {
  const [step, setStep] = useState(() =>
    Math.min(LAST_STEP, Math.max(FIRST_STEP, workspace.couple.onboardingStep)),
  );
  const next = () => setStep((current) => Math.min(LAST_STEP, current + 1));
  const stepProps: StepProps = { workspace, onDone: next };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">
          Step {step} of {LAST_STEP}
        </p>
        {step > FIRST_STEP ? (
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={LAST_STEP}
        aria-valuenow={step}
        className="bg-accent mt-3 h-1 overflow-hidden rounded-full"
      >
        <div
          className="bg-gold h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${(step / LAST_STEP) * 100}%` }}
        />
      </div>

      <h1 className="text-h1 mt-8 mb-8">{STEP_TITLES[step]}</h1>

      {step === 2 ? <NamesStep key={2} {...stepProps} /> : null}
      {step === 3 ? <PhotoStep key={3} {...stepProps} /> : null}
      {step === 4 ? <DateStep key={4} {...stepProps} /> : null}
      {step === 5 ? <VenueStep key={5} {...stepProps} /> : null}
      {step === 6 ? <ThemeStep key={6} {...stepProps} /> : null}
      {step === 7 ? <DreamStep key={7} {...stepProps} /> : null}
      {step === 8 ? <PublishStep workspace={workspace} appUrl={appUrl} /> : null}
    </div>
  );
}
