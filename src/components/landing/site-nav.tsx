"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  NavItems,
  Navbar,
  NavbarButton,
} from "@/components/ui/resizable-navbar";

const ITEMS = [
  { name: "How it works", link: "/#how-it-works" },
  { name: "Example wishlist", link: "/#wishlist" },
  { name: "Fees", link: "/#fees" },
  { name: "Questions", link: "/#faq" },
];

function Logo() {
  return (
    <Link href="/" className="font-heading relative z-20 px-2 text-2xl font-medium italic">
      ShaadiFund
    </Link>
  );
}

/** Site navigation: a full-width bar that tightens into a floating pill on scroll. */
export function SiteNav({ signupsOpen }: { signupsOpen: boolean }) {
  const primary = signupsOpen
    ? { href: "/sign-in", label: "Create your wishlist" }
    : { href: "/#join", label: "Join the waitlist" };
  const [open, setOpen] = useState(false);
  return (
    <Navbar className="fixed top-0 pt-3">
      <NavBody>
        <Logo />
        <NavItems items={ITEMS} />
        <div className="relative z-20 flex items-center gap-2">
          <NavbarButton as={Link} href="/sign-in" variant="secondary">
            Sign in
          </NavbarButton>
          <NavbarButton as={Link} href={primary.href} variant="dark">
            {primary.label}
          </NavbarButton>
        </div>
      </NavBody>

      <MobileNav className="px-4">
        <MobileNavHeader>
          <Logo />
          <MobileNavToggle isOpen={open} onClick={() => setOpen(!open)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={open}>
          {ITEMS.map((item) => (
            <Link
              key={item.link}
              href={item.link}
              onClick={() => setOpen(false)}
              className="text-foreground w-full py-1 text-lg"
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-2 flex w-full flex-col gap-3">
            <NavbarButton as={Link} href="/sign-in" variant="primary" className="w-full">
              Sign in
            </NavbarButton>
            <NavbarButton
              as={Link}
              href={primary.href}
              variant="dark"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {primary.label}
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
