"use client";

import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

/** A consequential admin action that must be confirmed with a written reason. */
export function ReasonAction({
  label,
  confirmLabel,
  warning,
  action,
}: {
  label: string;
  confirmLabel: string;
  warning: string;
  action: (reason: string) => Promise<ActionResult>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form
      className="grid min-w-64 gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await action(reason);
        setPending(false);
        if (result.ok) setOpen(false);
        else setError(result.message);
      }}
    >
      <p className="text-sm">{warning}</p>
      <Label htmlFor={id}>Reason</Label>
      <Input
        id={id}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="h-9"
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function SimpleAction({
  label,
  action,
}: {
  label: string;
  action: () => Promise<ActionResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await action();
          setPending(false);
          if (!result.ok) setError(result.message);
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {label}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
