import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/couple/sign-out-button";
import { cn } from "@/lib/utils";

/** Small shared pieces for the admin console: plain, dense and readable. */

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/couples", "Couples"],
  ["/admin/payments", "Payments"],
  ["/admin/events", "Webhook events"],
  ["/admin/audit", "Audit log"],
] as const;

/** Header, navigation and page column. Render only after the admin check has passed. */
export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b">
        <div className="max-w-page mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/admin" className="font-heading text-xl font-medium italic">
            VowFund <span className="text-muted-foreground text-sm not-italic">admin</span>
          </Link>
          <nav aria-label="Admin" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="underline-offset-4 hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="max-w-page mx-auto w-full flex-1 px-6 py-10">{children}</main>
    </>
  );
}

export function AdminHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h2">{title}</h1>
      {children}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-muted-foreground border-b text-xs tracking-wide uppercase">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-4 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}

export function EmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columns} className="text-muted-foreground px-4 py-10 text-center">
        {children}
      </td>
    </tr>
  );
}

const BADGE_TONES: Record<string, string> = {
  CAPTURED: "bg-success/10 text-success",
  PROCESSED: "bg-success/10 text-success",
  PUBLISHED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  SUSPENDED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-accent text-accent-foreground",
};

export function Badge({ children }: { children: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        BADGE_TONES[children] ?? "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function FilterLinks({
  base,
  param,
  current,
  options,
}: {
  base: string;
  param: string;
  current: string | undefined;
  options: { value: string | null; label: string }[];
}) {
  return (
    <nav aria-label="Filter" className="flex flex-wrap gap-1.5 text-sm">
      {options.map((option) => {
        const active = (option.value ?? undefined) === current;
        return (
          <Link
            key={option.label}
            href={option.value ? `${base}?${param}=${option.value}` : base}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:border-primary",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OlderLink({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <p className="mt-6 text-center">
      <Link href={href} className="text-sm underline underline-offset-4">
        Older entries
      </Link>
    </p>
  );
}
