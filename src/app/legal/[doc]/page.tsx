import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/site-footer";
import { NotFoundMessage } from "@/components/not-found-message";
import { CONTRIBUTION_CONFIG } from "@/modules/contribution/contribution.schema";

const SUPPORT_EMAIL = "support@shaadifund.in";
const FEE_PERCENT = CONTRIBUTION_CONFIG.feeBasisPoints / 100;

interface LegalDoc {
  title: string;
  summary: string;
  sections: [string, string[]][];
}

/**
 * Plain-language drafts describing how the product behaves today. They have not
 * been reviewed by a lawyer and must be before ShaadiFund takes real payments.
 */
const DOCS: Record<string, LegalDoc> = {
  privacy: {
    title: "Privacy",
    summary: "What we collect, why, and what you can ask us to do with it.",
    sections: [
      [
        "What we collect",
        [
          "From couples: your email address, your names, wedding date and venue, the photos and text you add to your page, and the dreams you list.",
          "From guests: your name, email address, the amount you give, and the message you choose to write. We ask for nothing else.",
          "Card, UPI and bank details are entered in the payment provider's own window. They never reach ShaadiFund and we do not store them.",
        ],
      ],
      [
        "How we use it",
        [
          "To show the couple's page, process a gift, send confirmations and thank-you notes, prevent abuse, and keep financial records.",
          "A guest's name, email and message are shared with the couple they gave to. Other guests see a name or message only if the guest and the couple both allow it.",
        ],
      ],
      [
        "Usage statistics",
        [
          "We count page visits using a code that changes every day and cannot be linked back to you. We do not store IP addresses for this, and we do not use advertising trackers.",
        ],
      ],
      [
        "Your choices",
        [
          `You can ask us to correct or delete your information by writing to ${SUPPORT_EMAIL}. We may need to keep records of payments for as long as the law requires.`,
        ],
      ],
    ],
  },
  terms: {
    title: "Terms of use",
    summary: "The basics of using ShaadiFund as a couple or a guest.",
    sections: [
      [
        "What ShaadiFund is",
        [
          "ShaadiFund lets a couple publish a page of experiences they hope for, and lets guests contribute towards them.",
          "ShaadiFund does not book travel, sell goods, or guarantee that any dream will happen. A dream marked as funded means contributions were received, nothing more.",
        ],
      ],
      [
        "Couples",
        [
          "You are responsible for what you publish. Do not post content that is unlawful, misleading, or that belongs to someone else.",
          "We may hide or suspend a page that breaks these terms or that we believe is being used to mislead guests.",
        ],
      ],
      [
        "Guests",
        [
          "A contribution is a gift to the couple. It is not a purchase and it is not a donation to a charity.",
          "Please give only amounts you intend to give. See the refunds page for what happens if something goes wrong.",
        ],
      ],
      [
        "Preview status",
        [
          "ShaadiFund is in preview. Payments run in demo mode and no real money moves. These terms will be updated, and reviewed by a lawyer, before that changes.",
        ],
      ],
    ],
  },
  refunds: {
    title: "Refunds and cancellations",
    summary: "What happens if a payment fails, is taken twice, or was a mistake.",
    sections: [
      [
        "Gifts are final",
        ["A completed contribution is a gift to the couple and is not normally refundable."],
      ],
      [
        "When we will refund",
        [
          "If you were charged twice for the same gift, or charged for a payment that we show as failed, we will refund the extra or failed charge in full, including the platform fee.",
          "If you gave a clearly mistaken amount, write to us as soon as possible and we will do what we can.",
        ],
      ],
      [
        "How to ask",
        [
          `Email ${SUPPORT_EMAIL} with the email address you used and the couple's page. Refunds go back to the original payment method; your bank decides how long that takes.`,
        ],
      ],
      [
        "Failed payments",
        [
          "A failed payment is never counted towards a dream. If money left your account for a failed payment, your bank normally returns it automatically within a few working days.",
        ],
      ],
    ],
  },
  fees: {
    title: "Payments and fees",
    summary: "What a guest pays, what the couple receives, and how payments are handled.",
    sections: [
      [
        "Platform fee",
        [
          `Creating and sharing a wedding page is free. When a guest gives, a platform fee of ${FEE_PERCENT}% of the gift is added on top and shown before payment.`,
          "The full gift amount counts towards the couple's dream. The fee is never taken out of the gift.",
        ],
      ],
      [
        "How payments are handled",
        [
          "Payments are processed by a licensed payment provider. ShaadiFund does not hold guests' money and does not store card or bank details.",
          "A contribution is counted only after the payment provider confirms it to our servers.",
        ],
      ],
      [
        "Current status",
        [
          "ShaadiFund is in preview and payments run in demo mode: no real money moves and nothing is paid out to couples. How and when couples receive funds will be described here before real payments are switched on.",
        ],
      ],
    ],
  },
  contact: {
    title: "Contact us",
    summary: "How to reach a person.",
    sections: [
      [
        "Support",
        [
          `Write to ${SUPPORT_EMAIL} about a payment, a page that concerns you, or anything else. Please include the email address you used and the couple's page, if there is one.`,
        ],
      ],
      [
        "Reporting a page",
        [
          `If you believe a wedding page is misleading or inappropriate, email ${SUPPORT_EMAIL} with its address and what worries you. We review every report.`,
        ],
      ],
    ],
  },
};

type Props = { params: Promise<{ doc: string }> };

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Not found" };
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) return <NotFoundMessage />;

  return (
    <>
      <main className="animate-rise mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Link href="/" className="font-heading text-2xl font-medium italic">
          ShaadiFund
        </Link>
        <p className="eyebrow mt-12">Draft</p>
        <h1 className="text-h1 mt-3">{content.title}</h1>
        <p className="text-lead text-muted-foreground mt-3">{content.summary}</p>
        <p
          role="note"
          className="bg-accent border-gold/40 mt-8 rounded-md border px-4 py-3 text-sm"
        >
          <strong className="font-semibold">This is a draft.</strong> It describes how ShaadiFund
          works today in plain language. It has not been reviewed by a lawyer and is not yet a
          binding policy.
        </p>
        {content.sections.map(([heading, paragraphs]) => (
          <section key={heading} className="mt-10">
            <h2 className="text-h3">{heading}</h2>
            {paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground mt-3 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
