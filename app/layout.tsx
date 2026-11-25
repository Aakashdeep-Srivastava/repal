import type { Metadata, Viewport } from "next";
import { Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SITE_URL } from "@/lib/site";

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

const SITE_TITLE = "RePal — rewards to money, on PayPal";
/** SERP-length (<=155 char) description; the longer pitch lives in OG below. */
const SITE_DESCRIPTION =
  "RePal reads your rewards' fine print, finds the cheapest price after rewards, and pays with PayPal — within the limits you set.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `template` gives child routes unique titles (e.g. "Reward Wallet — RePal")
  // without each one repeating the brand suffix. `default` is the homepage.
  title: { default: SITE_TITLE, template: "%s — RePal" },
  description: SITE_DESCRIPTION,
  applicationName: "RePal",
  manifest: "/manifest.webmanifest",
  // Homepage self-canonical; child routes override with their own path.
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    title: "RePal",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "RePal",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        // Demo poster first: it matches the OG video below and shows the payoff
        // ($249.99 → $157.59, save $92.40), so link unfurls carry the value prop.
        url: "/media/repal-demo-poster.jpg",
        width: 1920,
        height: 1080,
        alt: "RePal stacks 9 rewards into one PayPal payment — $249.99 down to $157.59, you save $92.40",
      },
      {
        url: "/rewards-panel.png",
        width: 1358,
        height: 874,
        alt: "RePal showing the cheapest price after stacked rewards",
      },
    ],
    videos: [
      {
        url: `${SITE_URL}/media/repal-demo-desktop.mp4`,
        secureUrl: `${SITE_URL}/media/repal-demo-desktop.mp4`,
        type: "video/mp4",
        width: 1920,
        height: 1080,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/media/repal-demo-poster.jpg"],
  },
};

/**
 * Entity / brand structured data, emitted site-wide from the root layout so
 * every route inherits it. Only facts that are actually true on the site:
 * real logo asset, real GitHub repo. No fabricated ratings, prices, or
 * sameAs profiles — add those to `sameAs`/SoftwareApplication only when real.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "RePal",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/repal-monogram.png`,
      description: SITE_DESCRIPTION,
      sameAs: ["https://github.com/Aakashdeep-Srivastava/repal"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "RePal",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "RePal",
      url: `${SITE_URL}/`,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      // Product demo video — enables Google video-rich results and video SEO.
      // Every field is real: the clip is self-hosted, 41s, and shows the actual
      // /stack flow. No fabricated view counts or interaction stats.
      "@type": "VideoObject",
      "@id": `${SITE_URL}/#demo-video`,
      name: "RePal — stack every reward into one PayPal payment",
      description:
        "A 40-second walkthrough: RePal reads the fine print on nine rewards, voids the ones that cannot stack, and combines the four that fit — $249.99 down to $157.59, saving $92.40 in one PayPal payment.",
      thumbnailUrl: [`${SITE_URL}/media/repal-demo-poster.jpg`],
      uploadDate: "2026-11-25",
      duration: "PT41S",
      contentUrl: `${SITE_URL}/media/repal-demo-desktop.mp4`,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
