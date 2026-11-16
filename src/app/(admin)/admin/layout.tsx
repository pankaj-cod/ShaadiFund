import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/couple/sign-out-button";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | VowFund admin" },
  robots: { index: false, follow: false },
};

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/couples", "Couples"],
  ["/admin/payments", "Payments"],
  ["/admin/events", "Webhook events"],
  ["/admin/audit", "Audit log"],
] as const;

/**
 * Frame for the admin console. It contains no data: every page checks the admin
 * role on the server before rendering anything, and shows "not found" otherwise.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
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
    </div>
  );
}
