"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { createDreamAction, updateDreamAction } from "@/app/(couple)/actions";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { ImageUpload } from "@/components/media/image-upload";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PAISE_PER_RUPEE } from "@/lib/money";
import {
  DREAM_CATEGORIES,
  DREAM_CATEGORY_LABELS,
  dreamInputSchema,
  type DreamInput,
} from "@/modules/dream/dream.schema";
import type { DreamDTO, ImageDTO } from "@/modules/wedding/wedding.types";

interface DreamFormProps {
  /** Present when editing. */
  dream?: DreamDTO;
  submitLabel: string;
  onSaved: (dream: DreamDTO) => void;
  onCancel?: () => void;
}

export function DreamForm({ dream, submitLabel, onSaved, onCancel }: DreamFormProps) {
  const [cover, setCover] = useState<ImageDTO | null>(dream?.coverImage ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DreamInput>({
    resolver: zodResolver(dreamInputSchema),
    defaultValues: {
      title: dream?.title ?? "",
      description: dream?.description ?? "",
      category: dream?.category ?? "HONEYMOON",
      targetRupees: dream ? dream.targetPaise / PAISE_PER_RUPEE : undefined,
      coverImageId: dream?.coverImage?.id ?? null,
      isActive: dream?.isActive ?? true,
    },
  });

  async function onSubmit(values: DreamInput) {
    setFormError(null);
    const result = dream
      ? await updateDreamAction(dream.id, values)
      : await createDreamAction(values);
    if (result.ok) {
      onSaved(result.data);
      return;
    }
    let placed = false;
    for (const [name, message] of Object.entries(result.fields ?? {})) {
      if (name in values) {
        setError(name as keyof DreamInput, { message });
        placed = true;
      }
    }
    if (!placed || result.fields?.coverImageId)
      setFormError(result.fields?.coverImageId ?? result.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <Field id="dream-title" label="What is the dream?" error={errors.title?.message}>
        <Input
          {...fieldAria("dream-title", errors.title?.message)}
          placeholder="A week in the Swiss Alps"
          {...register("title")}
        />
      </Field>

      <Field
        id="dream-description"
        label="Tell your guests about it"
        hint="A sentence or two about why this matters to you both."
        error={errors.description?.message}
      >
        <Textarea
          {...fieldAria("dream-description", errors.description?.message, "hint")}
          {...register("description")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="dream-category" label="Category" error={errors.category?.message}>
          <Select
            {...fieldAria("dream-category", errors.category?.message)}
            {...register("category")}
          >
            {DREAM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {DREAM_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="dream-target"
          label="Target amount (₹)"
          hint="Guests can give any part of this."
          error={errors.targetRupees?.message}
        >
          <Input
            {...fieldAria("dream-target", errors.targetRupees?.message, "hint")}
            type="number"
            inputMode="numeric"
            min={1000}
            step={1}
            placeholder="300000"
            {...register("targetRupees", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <ImageUpload
        kind="DREAM_COVER"
        label="Photo (optional)"
        aspect="card"
        value={cover}
        onChange={(image) => {
          setCover(image);
          setValue("coverImageId", image?.id ?? null, { shouldDirty: true });
        }}
      />

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
            <span>
              <span className="font-medium">Open for contributions</span>
              <span className="text-muted-foreground block">
                Turn this off to hide the dream from your page without deleting it.
              </span>
            </span>
          </label>
        )}
      />

      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
