import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section className="px-6 pb-24" aria-labelledby="cta-heading">
      <div className="bg-primary text-primary-foreground max-w-page relative mx-auto overflow-hidden rounded-[2rem] px-6 py-20 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(60%_80%_at_50%_0%,#b3924f_0%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <h2 id="cta-heading" className="text-h1 mx-auto max-w-2xl italic">
            Start with one dream. Add the rest when you are ready.
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="h-12 rounded-full px-7 text-base"
            >
              <Link href="/sign-in">Create Your Wedding Wishlist</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-primary-foreground hover:text-primary-foreground h-12 rounded-full border-white/30 bg-transparent px-7 text-base hover:bg-white/10"
            >
              <Link href="/demo">Explore a Demo Wedding</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
