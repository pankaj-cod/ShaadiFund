import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WaitlistForm } from "./waitlist-form";

export function ClosingCta({ signupsOpen }: { signupsOpen: boolean }) {
  return (
    <section id="join" className="scroll-mt-24 px-6 pb-24" aria-labelledby="cta-heading">
      <div className="bg-primary text-primary-foreground max-w-page relative mx-auto overflow-hidden rounded-[2rem] px-6 py-20 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(60%_80%_at_50%_0%,#b3924f_0%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl">
          {signupsOpen ? (
            <>
              <h2 id="cta-heading" className="text-h1 italic">
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
            </>
          ) : (
            <>
              <p className="text-eyebrow font-semibold tracking-[0.18em] text-[#e8c987] uppercase">
                Early access
              </p>
              <h2 id="cta-heading" className="text-h1 mt-4 italic">
                Be among the first couples on ShaadiFund
              </h2>
              <p className="text-primary-foreground/75 mx-auto mt-4 max-w-lg">
                We are opening to a small group first. Leave your email and we will let you know the
                moment your wedding page can go live.
              </p>
              <div className="mt-10">
                <WaitlistForm />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
