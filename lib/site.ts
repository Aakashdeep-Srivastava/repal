/** Canonical production origin. The www host 301s here (middleware.ts), and
 *  metadataBase (app/layout.tsx) pins every canonical/OG URL to it. Shared by
 *  the root metadata, sitemap.ts, and robots.ts so there is one source of truth. */
export const SITE_URL = "https://repal.shop";
