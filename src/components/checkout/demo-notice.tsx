import { cn } from "@/lib/utils";

/** Shown wherever money is discussed while payments are not live (ADR 0003). */
export function DemoNotice({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "border-gold/40 bg-accent text-accent-foreground rounded-md border px-3.5 py-2.5 text-sm",
        className,
      )}
    >
      <strong className="font-semibold">Demo mode.</strong> No real money moves.
    </p>
  );
}
