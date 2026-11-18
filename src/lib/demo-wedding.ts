import type { PublicWedding } from "@/modules/wedding/wedding.types";
import { stockImage } from "./stock-photos";

/**
 * A made-up wedding used for the public demo and for examples on the landing
 * page. Nothing here is a real couple, guest or payment; the photos are
 * free-licensed stock photos (see stock-photos.ts).
 */
export const DEMO_WEDDING: PublicWedding = {
  slug: "demo",
  theme: "MINIMAL_IVORY",
  partnerOneName: "Meera",
  partnerTwoName: "Arjun",
  weddingDate: "2027-02-14",
  venueName: "Lake Pichola",
  city: "Udaipur",
  welcomeMessage:
    "We already have a home full of things. What we are dreaming of now is time together, and stories we will still be telling at seventy.",
  thankYouMessage: "Thank you for being part of the beginning of everything.",
  heroImage: stockImage("weddingCouple", 2000),
  allowIndexing: false,
  dreams: [
    {
      id: "00000000-0000-7000-8000-000000000001",
      title: "A week in the Swiss Alps",
      description: "Train rides through the mountains and our first snowfall together.",
      category: "HONEYMOON",
      targetPaise: 30_000_000,
      fundedPaise: 18_750_000,
      contributionCount: 23,
      coverImage: stockImage("alps", 900),
    },
    {
      id: "00000000-0000-7000-8000-000000000002",
      title: "Sunrise in the Maldives",
      description: "Three slow mornings over the water, with nowhere to be.",
      category: "TRAVEL",
      targetPaise: 22_000_000,
      fundedPaise: 6_600_000,
      contributionCount: 9,
      coverImage: stockImage("maldives", 900),
    },
    {
      id: "00000000-0000-7000-8000-000000000003",
      title: "Our first car",
      description: "Weekend drives out of the city, windows down, playlist up.",
      category: "LIFESTYLE",
      targetPaise: 80_000_000,
      fundedPaise: 21_500_000,
      contributionCount: 14,
      coverImage: stockImage("car", 900),
    },
    {
      id: "00000000-0000-7000-8000-000000000004",
      title: "A kitchen we love cooking in",
      description: "New counters and good light for the home we are building.",
      category: "HOME",
      targetPaise: 15_000_000,
      fundedPaise: 15_000_000,
      contributionCount: 18,
      coverImage: stockImage("kitchen", 900),
    },
    {
      id: "00000000-0000-7000-8000-000000000005",
      title: "Learning to scuba dive",
      description: "Getting certified together in the Andamans.",
      category: "ADVENTURES",
      targetPaise: 9_000_000,
      fundedPaise: 2_100_000,
      contributionCount: 4,
      coverImage: stockImage("scuba", 900),
    },
  ],
  gifts: [
    {
      name: "Ananya",
      dreamTitle: "A week in the Swiss Alps",
      message: "For the two people who taught me what a good team looks like. Go see the snow.",
      amountPaise: null,
    },
    {
      name: "Kabir Uncle and Sunita Aunty",
      dreamTitle: "A kitchen we love cooking in",
      message: "May this kitchen always smell of good food and be full of people you love.",
      amountPaise: null,
    },
    {
      name: "Anonymous",
      dreamTitle: "Our first car",
      message: "Drive safe, and take the long way home.",
      amountPaise: null,
    },
  ],
};
