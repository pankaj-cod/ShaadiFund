import Link from "next/link";
import { getEnv } from "@/lib/env";
import { STOCK_PHOTOS } from "@/lib/stock-photos";

function links(): { heading: string; items: [string, string][] }[] {
  return [
    {
      heading: "ShaadiFund",
      items: [
        ["How it works", "/#how-it-works"],
        ["Explore a demo wedding", "/demo"],
        [
          getEnv().SIGNUPS_OPEN ? "Create your wishlist" : "Join the waitlist",
          getEnv().SIGNUPS_OPEN ? "/sign-in" : "/#join",
        ],
        ["Sign in", "/sign-in"],
      ],
    },
    {
      heading: "Legal",
      items: [
        ["Privacy", "/legal/privacy"],
        ["Terms", "/legal/terms"],
        ["Refunds and cancellations", "/legal/refunds"],
        ["Payments and fees", "/legal/fees"],
      ],
    },
    {
      heading: "Help",
      items: [
        ["Common questions", "/#faq"],
        ["Contact us", "/legal/contact"],
      ],
    },
  ];
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="max-w-page mx-auto grid gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-heading text-2xl font-medium italic">ShaadiFund</p>
          <p className="text-muted-foreground mt-3 max-w-xs text-sm">
            Give them memories, not things. A wedding gifting experience for Indian couples.
          </p>
        </div>
        {links().map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <p className="eyebrow">{group.heading}</p>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {group.items.map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="text-muted-foreground border-t px-6 py-6 text-center text-xs">
        <p>
          ShaadiFund is in preview. Payments currently run in demo mode and no real money moves.
        </p>
        <p className="mt-2">
          Sample photos by{" "}
          {Object.values(STOCK_PHOTOS).map((photo, index, all) => (
            <span key={photo.page}>
              <a href={photo.page} className="underline-offset-4 hover:underline" rel="noopener">
                {photo.photographer}
              </a>
              {index < all.length - 2 ? ", " : index === all.length - 2 ? " and " : ""}
            </span>
          ))}{" "}
          on{" "}
          <a
            href="https://unsplash.com"
            className="underline-offset-4 hover:underline"
            rel="noopener"
          >
            Unsplash
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
