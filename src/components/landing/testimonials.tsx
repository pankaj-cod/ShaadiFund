import { InfiniteMovingCards, type MovingCard } from "@/components/ui/infinite-moving-cards";

/** Placeholder quotes. Replace with real, attributed ones once couples have used the product. */
const SAMPLES: MovingCard[] = [
  {
    quote:
      "We did not want a fourth dinner set. Reading everyone's messages while planning the trip was the best part.",
    name: "Sample couple",
    title: "Illustrative quote, not a real customer",
  },
  {
    quote:
      "I live abroad and could not attend. This let me be part of it in a way an envelope never could.",
    name: "Sample guest",
    title: "Illustrative quote, not a real customer",
  },
  {
    quote:
      "My parents were unsure at first. Then they saw the page, and chose the dream themselves.",
    name: "Sample couple",
    title: "Illustrative quote, not a real customer",
  },
  {
    quote:
      "Getting a thank-you note from the two of them on the same day made me tear up a little.",
    name: "Sample guest",
    title: "Illustrative quote, not a real customer",
  },
].map((card, index) => ({ ...card, name: `${card.name} ${index + 1}` }));

export function Testimonials() {
  return (
    <section className="py-20" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-prose px-6 text-center">
        <p className="eyebrow">What it could feel like</p>
        <h2 id="testimonials-heading" className="text-h1 mt-4">
          In their words
        </h2>
        <p className="text-muted-foreground mt-4">
          ShaadiFund is new, so these are sample quotes written to illustrate the experience. Real
          stories will replace them.
        </p>
      </div>
      <InfiniteMovingCards items={SAMPLES} className="mt-10" />
    </section>
  );
}
