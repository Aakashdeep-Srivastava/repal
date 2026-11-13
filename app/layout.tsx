import type { Metadata, Viewport } from "next";
import { Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
/* Display — Fraunces: an optical-sized old-style serif for the hero voice. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "RePal — rewards to money, on PayPal",
  description:
    "An agentic rewards-to-money layer. State a goal; the AI reads your rewards' fine print, a deterministic optimizer finds the cheapest SKU after rewards, and PayPal moves the money across the whole lifecycle.",
  applicationName: "RePal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RePal",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

/**
 * Runs before first paint: applies the persisted theme (default light) so there
 * is no dark/light flash on load. Kept tiny and inline on purpose.
 */
const NO_FLASH_THEME = `(function(){try{var t=localStorage.getItem('repal-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistMono.variable} ${fraunces.variable}`}
    >
      <head>
        {/* Body / UI — Hanken Grotesk, a warm humanist grotesque (not a default
         * geometric/system sans). Loaded at runtime via <link> rather than
         * next/font so the sandboxed CI image builds offline. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
