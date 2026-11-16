import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | ShaadiFund admin" },
  robots: { index: false, follow: false },
};

/**
 * Deliberately empty. The admin navigation lives in AdminFrame, which each page
 * renders only after confirming on the server that the visitor is an admin, so
 * nobody else sees even the menu.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
