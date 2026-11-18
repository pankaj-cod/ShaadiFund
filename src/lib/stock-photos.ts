import type { ImageDTO } from "@/modules/wedding/wedding.types";

/**
 * Photographs used on the marketing pages and the demo wedding. All are free to
 * use under the Unsplash License (https://unsplash.com/license), checked one by
 * one on 2026-11-18 (none are paid "Unsplash+" images). They are served from
 * Unsplash's own image servers, which is how Unsplash asks for them to be used.
 *
 * Real couples' pages never show these: their dreams use their own uploads, or
 * drawn artwork, so guests are never shown a stock photo as if it were theirs.
 */
interface StockPhoto {
  /** Unsplash's image id, the part after "photo-" in the image address. */
  imageId: string;
  width: number;
  height: number;
  photographer: string;
  /** The photo's page on Unsplash, for credits. */
  page: string;
}

export const STOCK_PHOTOS = {
  alps: {
    imageId: "1577953521789-b1e88d5785a8",
    width: 4000,
    height: 6000,
    photographer: "Kevin Schmid",
    page: "https://unsplash.com/photos/train-moves-between-snowfield--kTgps7o15g",
  },
  maldives: {
    imageId: "1697898109604-e06e88b15271",
    width: 5464,
    height: 3640,
    photographer: "Matheen Faiz",
    page: "https://unsplash.com/photos/a-couple-of-houses-sitting-on-top-of-a-body-of-water-iwZqmickJxA",
  },
  car: {
    imageId: "1553875722-54793bce0406",
    width: 4684,
    height: 3123,
    photographer: "Jonathan Borba",
    page: "https://unsplash.com/photos/man-and-woman-sitting-on-cars-trunk-7fDndqTb5pk",
  },
  kitchen: {
    imageId: "1556912167-f556f1f39fdf",
    width: 6000,
    height: 4000,
    photographer: "roam in color",
    page: "https://unsplash.com/photos/four-brown-stools-RryFk4n-vOs",
  },
  scuba: {
    imageId: "1682687981630-cefe9cd73072",
    width: 7406,
    height: 4937,
    photographer: "NEOM",
    page: "https://unsplash.com/photos/a-woman-scubas-over-a-colorful-coral-reef-jTxhUMyPTrE",
  },
  weddingCouple: {
    imageId: "1764286954620-28029fbae9b6",
    width: 6720,
    height: 4480,
    photographer: "Sabesh Photography LTD",
    page: "https://unsplash.com/photos/a-bride-and-groom-in-traditional-indian-wedding-attire-OzyvCE9a60M",
  },
  festiveCouple: {
    imageId: "1722952908609-4b57e23da1ee",
    width: 4000,
    height: 6000,
    photographer: "ARTO SURAJ",
    page: "https://unsplash.com/photos/a-bride-and-groom-posing-for-a-picture-o-YVbMFIAsI",
  },
  henna: {
    imageId: "1621801306185-8c0ccf9c8eb8",
    width: 6720,
    height: 4480,
    photographer: "Love Arya",
    page: "https://unsplash.com/photos/hands-with-henna-holding-in-celebration-SUwPo4ErQCc",
  },
} satisfies Record<string, StockPhoto>;

export type StockPhotoKey = keyof typeof STOCK_PHOTOS;

/**
 * The address of a photo resized and compressed by Unsplash's image service,
 * so a phone never downloads a 6000-pixel original.
 */
export function stockPhotoUrl(key: StockPhotoKey, width: number): string {
  const photo = STOCK_PHOTOS[key];
  return `https://images.unsplash.com/photo-${photo.imageId}?auto=format&fit=crop&w=${width}&q=72`;
}

/** The same photo in the shape the wedding page components expect. */
export function stockImage(key: StockPhotoKey, width = 1200): ImageDTO {
  const photo = STOCK_PHOTOS[key];
  return {
    id: `stock-${key}`,
    url: stockPhotoUrl(key, width),
    width,
    height: Math.round((width * photo.height) / photo.width),
  };
}
