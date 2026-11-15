import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared look for every text control. 16px text on phones stops iOS zooming on focus. */
export const controlClassName =
  "border-input bg-card text-foreground placeholder:text-muted-foreground w-full min-w-0 rounded-md border px-3.5 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none " +
  "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:outline-none " +
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-[0.9375rem]";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(controlClassName, "h-11", className)}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClassName, "min-h-28 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select data-slot="select" className={cn(controlClassName, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export { Input, Select, Textarea };
