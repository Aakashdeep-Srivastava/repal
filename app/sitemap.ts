import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Public sitemap — an explicit allow-list, NOT a crawl of app/. Only true
 * marketing/legal surfaces that server-render meaningful content to an
 * anonymous visitor belong here. Authenticated app shells (/wallet, /insights,
 * /stack, /rescue, /mandate), the shopping journey (/shop, /product, /checkout),
 * and per-receipt /verify pages are deliberately excluded — they carry
 * `robots: { index: false }` and are Disallow'd in robots.ts.
 *
 * priority/changefreq are omitted on purpose — Google ignores both.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-23");
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      // Video sitemap extension — surfaces the demo clip to Google Video search.
      videos: [
        {
          title: "RePal — stack every reward into one PayPal payment",
          thumbnail_loc: `${SITE_URL}/media/repal-demo-poster.jpg`,
          description:
            "RePal reads the fine print on nine rewards, voids the ones that cannot stack, and combines the four that fit — $249.99 down to $157.59, saving $92.40 in one PayPal payment.",
          content_loc: `${SITE_URL}/media/repal-demo-desktop.mp4`,
        },
      ],
    },
    { url: `${SITE_URL}/about`, lastModified },
    { url: `${SITE_URL}/security`, lastModified },
    { url: `${SITE_URL}/privacy`, lastModified },
    { url: `${SITE_URL}/terms`, lastModified },
  ];
}
