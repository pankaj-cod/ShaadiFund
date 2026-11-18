import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { getEnv } from "@/lib/env";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "A wedding gifting experience for Indian couples. Guests contribute towards the dreams a couple wants to live, with a personal message.";

export function generateMetadata(): Metadata {
  return {
    // Link previews need absolute addresses; this makes relative ones work.
    metadataBase: new URL(getEnv().APP_URL),
    title: {
      default: "ShaadiFund: Give them memories, not things",
      template: "%s | ShaadiFund",
    },
    description: DESCRIPTION,
    openGraph: {
      siteName: "ShaadiFund",
      locale: "en_IN",
      type: "website",
      title: "ShaadiFund: Give them memories, not things",
      description: DESCRIPTION,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf8f2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
