import type { Metadata } from "next";

// Authenticated impact dashboard (personalized spend/savings) → noindex.
export const metadata: Metadata = {
  title: "Insights",
  description: "Verified spend, realized reward savings, refunds, and payouts — each number from a signed receipt.",
  robots: { index: false, follow: true },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
