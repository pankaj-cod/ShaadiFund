import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Holding page for the foundation phase. The full landing page replaces this in
 * the frontend phase; its one call to action leads to the working sign-in.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-prose text-center">
        <p className="eyebrow">VowFund</p>
        <h1 className="text-display mt-6 italic">Give them memories, not things.</h1>
        <div className="ornament-rule mx-auto mt-10 max-w-48" aria-hidden="true">
          <span className="bg-gold size-1.5 rotate-45" />
        </div>
        <p className="text-lead text-muted-foreground mt-10">
          A wedding gifting experience for Indian couples, where guests help bring a couple&rsquo;s
          dreams to life. We are building it now.
        </p>
        <Button asChild size="lg" className="mt-10">
          <Link href="/sign-in">Create your wedding wishlist</Link>
        </Button>
      </div>
    </main>
  );
}
