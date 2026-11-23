import type { Metadata } from "next";

// Server layout that only carries metadata for the client Wallet page.
// Authenticated app surface showing personalized/sample data → noindex.
export const metadata: Metadata = {
  title: "Reward Wallet",
  description: "See every connected reward's real cash value, terms, and expiry.",
  robots: { index: false, follow: true },
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
