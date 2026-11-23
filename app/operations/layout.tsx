import type { Metadata } from "next";

// Operator-only reporting (RePal's own PayPal account) — never indexed.
export const metadata: Metadata = {
  title: "Operator reporting",
  description: "RePal platform PayPal account reporting — operator-only.",
  robots: { index: false, follow: false },
};

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
