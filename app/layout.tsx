import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RePal — rewards to money, on PayPal",
  description:
    "An agentic rewards-to-money layer. State a goal; the AI reads your rewards' fine print, a deterministic optimizer finds the cheapest SKU after rewards, and PayPal moves the money across the whole lifecycle.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
