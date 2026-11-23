import type { Metadata } from "next";

// Session-bound product results (reads ?q from URL) → not a stable indexable
// URL; noindex. The persistent shell lives in app/(shop)/layout.tsx.
export const metadata: Metadata = {
  title: "Shop",
  description: "The cheapest price after your rewards, across the catalog.",
  robots: { index: false, follow: true },
};

export default function ShopRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
