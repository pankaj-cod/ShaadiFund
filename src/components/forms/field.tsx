import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  /** Must match the id of the control inside. */
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** Label, control, hint and error, wired together for screen readers. */
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** aria attributes for the control inside a Field. */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-destructive/30 bg-destructive/5 text-destructive",
    success: "border-success/30 bg-success/5 text-success",
    info: "border-border bg-muted text-muted-foreground",
  } as const;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-3.5 py-2.5 text-sm", tones[tone])}
    >
      {children}
    </p>
  );
}
