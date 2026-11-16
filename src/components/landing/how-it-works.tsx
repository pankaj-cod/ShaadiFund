"use client";

import { Timeline } from "@/components/ui/timeline";

function Step({ heading, points }: { heading: string; points: string[] }) {
  return (
    <div className="bg-card shadow-soft rounded-2xl border p-6 sm:p-8">
      <p className="font-heading text-2xl">{heading}</p>
      <ul className="text-muted-foreground mt-4 grid gap-2.5">
        {points.map((point) => (
          <li key={point} className="flex gap-3">
            <span className="bg-gold mt-2.5 size-1.5 shrink-0 rotate-45" aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  {
    title: "Dream",
    content: (
      <Step
        heading="Create your wedding page"
        points={[
          "Add your names, date, venue and a photo. It takes a few minutes.",
          "List the experiences you are dreaming of, each with a story and a target.",
          "Pick a look: Minimal Ivory, Royal Indian or Modern Editorial.",
        ]}
      />
    ),
  },
  {
    title: "Share",
    content: (
      <Step
        heading="Send one link to your guests"
        points={[
          "Share it on WhatsApp or print it on your invitation.",
          "Guests choose a dream, an amount and write you a message. No account needed.",
          "You decide what is public: names, messages, amounts and progress.",
        ]}
      />
    ),
  },
  {
    title: "Live it",
    content: (
      <Step
        heading="Watch your dreams fill up"
        points={[
          "Every contribution is verified before it counts.",
          "Read each message and send a personal thank-you in one tap.",
          "Your guests get a keepsake page showing what they helped make possible.",
        ]}
      />
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20" aria-labelledby="how-heading">
      <div className="mx-auto max-w-prose px-6 text-center">
        <p className="eyebrow">How it works</p>
        <h2 id="how-heading" className="text-h1 mt-4">
          Three steps, from a wish to a memory
        </h2>
      </div>
      <Timeline data={STEPS} />
    </section>
  );
}
