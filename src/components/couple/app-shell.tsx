import Link from "next/link";
import type { ReactNode } from "react";

/** Frame for signed-in and sign-in screens: brand bar and a centred column. */
export function AppShell({
  children,
  actions,
  width = "narrow",
  glow = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  width?: "narrow" | "wide";
  /** A soft champagne glow behind the page, for welcoming screens. */
  glow?: boolean;
}) {
  return (
    <div className="relative flex flex-1 flex-col">
      {glow ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] opacity-70 [background:radial-gradient(70%_60%_at_50%_0%,#f1dfbd_0%,transparent_70%)]"
          aria-hidden="true"
        />
      ) : null}
      <header className="bg-background/70 sticky top-0 z-30 border-b backdrop-blur">
        <div className="max-w-page mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="font-heading text-2xl font-medium italic">
            ShaadiFund
          </Link>
          {actions}
        </div>
      </header>
      <main
        className={`animate-rise mx-auto w-full flex-1 px-6 py-10 sm:py-14 ${width === "narrow" ? "max-w-xl" : "max-w-page"}`}
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
