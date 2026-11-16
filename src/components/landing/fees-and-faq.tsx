import { CONTRIBUTION_CONFIG } from "@/modules/contribution/contribution.schema";

const FEE_PERCENT = CONTRIBUTION_CONFIG.feeBasisPoints / 100;

const FAQS: [string, string][] = [
  [
    "Is it awkward to ask for money?",
    "Your page never asks for money. It shares what you are dreaming of and lets guests who want to give something choose how. Many couples add a line such as “your presence is the greatest gift”. You control whether amounts and progress are shown at all.",
  ],
  [
    "Do guests need an account or an app?",
    "No. A guest opens your link, picks a dream, and gives with their name and email. That is all we ask them for.",
  ],
  [
    "Can several guests contribute to the same dream?",
    "Yes. Guests can give any part of a dream, and a dream can receive more than its target.",
  ],
  [
    "Can a guest stay anonymous?",
    "Yes. An anonymous guest's name is hidden from other guests. The couple still sees who gave, so they can say thank you.",
  ],
  [
    "Does a funded dream mean the trip is booked?",
    "No. ShaadiFund collects contributions towards your dreams; it does not book travel or buy anything. How and when you make the dream happen is up to you.",
  ],
  [
    "Can I take real payments today?",
    "Not yet. ShaadiFund is in preview and payments run in demo mode, so no real money moves. We will say clearly here when that changes.",
  ],
];

export function FeesAndFaq({ demo }: { demo: boolean }) {
  return (
    <>
      <section id="fees" className="scroll-mt-24 px-6 py-20" aria-labelledby="fees-heading">
        <div className="bg-card shadow-soft mx-auto max-w-3xl rounded-3xl border p-8 text-center sm:p-12">
          <p className="eyebrow">Fees, plainly</p>
          <h2 id="fees-heading" className="text-h1 mt-4">
            Free for couples
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
            Creating and sharing your page costs nothing. When a guest gives, a platform fee of{" "}
            {FEE_PERCENT}% is added on top and shown before they pay. The gift itself is never
            reduced.
          </p>
          <dl className="mx-auto mt-8 grid max-w-sm gap-2 text-left text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">A guest gives</dt>
              <dd className="font-medium tabular-nums">₹5,000</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Platform fee ({FEE_PERCENT}%)</dt>
              <dd className="tabular-nums">₹125</dd>
            </div>
            <div className="flex justify-between gap-6 border-t pt-2">
              <dt className="font-medium">The guest pays</dt>
              <dd className="font-semibold tabular-nums">₹5,125</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="font-medium">Counted towards the dream</dt>
              <dd className="font-semibold tabular-nums">₹5,000</dd>
            </div>
          </dl>
          {demo ? (
            <p className="text-muted-foreground mt-8 text-sm">
              ShaadiFund is in preview: payments run in demo mode and no real money moves yet.
            </p>
          ) : null}
        </div>
      </section>

      <section
        id="faq"
        className="mx-auto max-w-3xl scroll-mt-24 px-6 py-20"
        aria-labelledby="faq-heading"
      >
        <div className="text-center">
          <p className="eyebrow">Common questions</p>
          <h2 id="faq-heading" className="text-h1 mt-4">
            Before you begin
          </h2>
        </div>
        <div className="mt-10 divide-y border-y">
          {FAQS.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="font-heading flex cursor-pointer list-none items-center justify-between gap-6 text-xl [&::-webkit-details-marker]:hidden">
                {question}
                <span
                  className="text-gold-ink shrink-0 text-2xl leading-none transition-transform duration-200 group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 leading-relaxed">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
