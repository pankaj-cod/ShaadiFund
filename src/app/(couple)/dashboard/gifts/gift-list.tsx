"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { sendThankYouAction, setGiftMessageHiddenAction } from "@/app/(couple)/actions";
import { Field, fieldAria, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import {
  thankYouSchema,
  type CoupleGift,
  type ThankYouInput,
} from "@/modules/contribution/gifts.schema";

function ThankYouForm({ gift, onDone }: { gift: CoupleGift; onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ThankYouInput>({
    resolver: zodResolver(thankYouSchema),
    defaultValues: { note: gift.thankYouNote ?? "" },
  });
  const id = `note-${gift.id}`;

  return (
    <form
      noValidate
      className="mt-4 grid gap-3"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        const result = await sendThankYouAction(gift.id, values);
        if (result.ok) onDone();
        else setFormError(result.fields?.note ?? result.message);
      })}
    >
      <Field
        id={id}
        label={`Your thank-you to ${gift.guestName}`}
        hint={
          gift.thankYouNote
            ? "Your guest sees the updated note on their gift page. They are not emailed again."
            : "We will email this to your guest and show it on their gift page."
        }
        error={errors.note?.message}
      >
        <Textarea {...fieldAria(id, errors.note?.message, "hint")} {...register("note")} />
      </Field>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Sending…" : gift.thankYouNote ? "Save note" : "Send thank-you"}
        </Button>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function GiftCard({ gift }: { gift: CoupleGift }) {
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refunded = gift.status === "REFUNDED";

  async function toggleHidden(hidden: boolean) {
    setBusy(true);
    setError(null);
    const result = await setGiftMessageHiddenAction(gift.id, hidden);
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <li className="bg-card shadow-soft rounded-xl border p-6" aria-busy={busy}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-h3">{gift.guestName}</h3>
        <p
          className={`text-lg font-semibold tabular-nums ${refunded ? "line-through opacity-60" : ""}`}
        >
          {formatPaise(gift.amountPaise)}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        {gift.guestEmail} · towards {gift.dreamTitle} · {formatDateTime(gift.receivedAt)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
        {refunded ? (
          <span className="bg-destructive/10 text-destructive rounded-full px-2.5 py-1">
            Refunded
          </span>
        ) : null}
        {gift.isAnonymous ? (
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1">
            Anonymous to other guests
          </span>
        ) : null}
        {gift.message?.isPrivate ? (
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1">
            Private message
          </span>
        ) : null}
        {gift.message?.isHidden ? (
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1">
            Hidden from your page
          </span>
        ) : null}
      </div>

      {gift.message ? (
        <blockquote className="border-gold mt-4 border-l-2 pl-4">
          <p className="font-heading text-xl leading-relaxed whitespace-pre-line italic">
            {gift.message.body}
          </p>
        </blockquote>
      ) : null}

      {gift.thankYouNote && !writing ? (
        <div className="bg-secondary mt-4 rounded-lg p-4">
          <p className="eyebrow">Your thank-you</p>
          <p className="mt-2 whitespace-pre-line">{gift.thankYouNote}</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}

      {writing ? (
        <ThankYouForm gift={gift} onDone={() => setWriting(false)} />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={gift.thankYouNote ? "outline" : "default"}
            size="sm"
            onClick={() => setWriting(true)}
          >
            {gift.thankYouNote ? "Edit thank-you" : "Say thank you"}
          </Button>
          {gift.message && !gift.message.isPrivate ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => toggleHidden(!gift.message?.isHidden)}
            >
              {gift.message.isHidden ? "Show message on page" : "Hide message from page"}
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function GiftList({ gifts }: { gifts: CoupleGift[] }) {
  return (
    <ul className="grid gap-4">
      {gifts.map((gift) => (
        <GiftCard key={gift.id} gift={gift} />
      ))}
    </ul>
  );
}
