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
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Audiences />
        <ExampleWishlist />
        <Testimonials />
        <FeesAndFaq demo={isDemoPayments(getEnv())} />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
