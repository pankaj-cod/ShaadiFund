import type { Metadata } from "next";
import { SiteFooter } from "@/components/landing/site-footer";
import { WeddingView } from "@/components/wedding/wedding-view";
import { DEMO_WEDDING } from "@/lib/demo-wedding";

export const metadata: Metadata = {
  title: "Demo wedding",
  description: "A sample ShaadiFund wedding page, with made-up names, dreams and messages.",
};

/** A sample wedding page. Everything on it is invented; nothing can be contributed to. */
export default function DemoWeddingPage() {
  return (
    <>
      <WeddingView
        wedding={DEMO_WEDDING}
        preview
        demo
        banner="Demo wedding. The couple, dreams, amounts and messages here are sample content."
        backHref="/"
      />
      <SiteFooter />
    </>
  );
}
