import Link from "next/link";
import type { ReactNode } from "react";

/** Frame for signed-in and sign-in screens: brand bar and a centred column. */
export function AppShell({
  children,
  actions,
  width = "narrow",
}: {
  children: ReactNode;
  actions?: ReactNode;
  width?: "narrow" | "wide";
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="max-w-page mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="font-heading text-xl font-medium italic">
            VowFund
          </Link>
          {actions}
        </div>
      </header>
      <main
        className={`mx-auto w-full flex-1 px-6 py-10 sm:py-14 ${width === "narrow" ? "max-w-xl" : "max-w-page"}`}
      >
        {children}
      </main>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="bg-muted h-8 w-2/3 rounded-md" />
      <div className="bg-muted h-4 w-full rounded-md" />
      <div className="bg-muted h-40 w-full rounded-lg" />
    </div>
  );
}
