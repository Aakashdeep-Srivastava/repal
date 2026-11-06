import type { MetadataRoute } from "next";

/**
 * PWA web app manifest (served at /manifest.webmanifest). Makes RePal
 * installable on mobile and desktop — "Add to Home Screen" / "Install app" —
 * launching standalone (no browser chrome) from the home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RePal — rewards to money",
    short_name: "RePal",
    description:
      "An agentic rewards-to-money layer on PayPal. State a goal; the AI reads your rewards' fine print and the optimizer finds the cheapest buy after rewards.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["finance", "shopping", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
