import { Audiences } from "@/components/landing/audiences";
import { ClosingCta } from "@/components/landing/closing-cta";
import { ExampleWishlist } from "@/components/landing/example-wishlist";
import { FeesAndFaq } from "@/components/landing/fees-and-faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { Testimonials } from "@/components/landing/testimonials";
import { getEnv, isDemoPayments } from "@/lib/env";

export default function HomePage() {
  const env = getEnv();
  return (
    <>
      <SiteNav signupsOpen={env.SIGNUPS_OPEN} />
      <main className="flex-1">
        <Hero signupsOpen={env.SIGNUPS_OPEN} />
        <HowItWorks />
        <Audiences />
        <ExampleWishlist />
        <Testimonials />
        <FeesAndFaq demo={isDemoPayments(env)} />
        <ClosingCta signupsOpen={env.SIGNUPS_OPEN} />
      </main>
      <SiteFooter />
    </>
  );
}
