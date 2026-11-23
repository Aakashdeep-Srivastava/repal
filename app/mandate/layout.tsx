import type { Metadata } from "next";

// Spending-authority configuration (PayPal Vault) → noindex.
export const metadata: Metadata = {
  title: "Mandate Studio",
  description: "Configure the agent's delegated PayPal spending authority and limits.",
  robots: { index: false, follow: true },
};

export default function MandateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
