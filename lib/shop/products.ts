import type { Offer } from "@/lib/types";
import type { Product, ProductSearchResponse } from "@/lib/shop/types";
import { findOffers } from "@/lib/channel3";

/**
 * Product discovery for the shopping journey.
 *
 * Real-over-mock honesty: when CHANNEL3_API_KEY is configured we serve live
 * Channel3 results (source: "channel3"). Otherwise we serve the LABELLED
 * SANDBOX catalog below (source: "sandbox") so the journey still works end to
 * end in dev/demo. The `source` field always reflects provenance — sandbox data
 * is demo-only and must NEVER be presented as a live offer. See lib/shop/types.
 *
 * Nothing here recomputes money — prices are passed straight through from the
 * source (Channel3) or the static catalog; the optimizer owns all plan math.
 *
 * OWNER: shopping journey (data boundary).
 */

/**
 * DEMO DATA — NOT LIVE. A deterministic, in-file catalog served only when
 * Channel3 is not configured. Ids are stable (no Math.random / Date.now) so
 * shared-element morphs and verify flows stay consistent across requests.
 * These are illustrative products with plausible retailers and prices; they are
 * labelled `source: "sandbox"` and must be shown to users as demo data.
 */
const SANDBOX_CATALOG: readonly Product[] = [
  {
    id: "sbx-headphones-sony-wh1000xm5",
    title: "Sony WH-1000XM5 Wireless Noise-Cancelling Headphones",
    priceUsd: 348.0,
    retailer: "bestbuy.com",
    buyUrl: "#",
    category: "headphones",
    description:
      "Over-ear wireless headphones with industry-leading adaptive noise cancellation and 30-hour battery.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-headphones-bose-qc-ultra",
    title: "Bose QuietComfort Ultra Headphones",
    priceUsd: 429.0,
    retailer: "amazon.com",
    buyUrl: "#",
    category: "headphones",
    description:
      "Premium over-ear headphones with immersive spatial audio and world-class quiet.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-headphones-sennheiser-hd560s",
    title: "Sennheiser HD 560S Open-Back Headphones",
    priceUsd: 179.95,
    retailer: "bhphotovideo.com",
    buyUrl: "#",
    category: "headphones",
    description:
      "Reference-grade open-back headphones tuned for analytical, natural listening.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-earbuds-airpods-pro-2",
    title: "Apple AirPods Pro (2nd generation, USB-C)",
    priceUsd: 249.0,
    retailer: "apple.com",
    buyUrl: "#",
    category: "earbuds",
    description:
      "In-ear earbuds with active noise cancellation, adaptive audio and USB-C charging case.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-earbuds-galaxy-buds3-pro",
    title: "Samsung Galaxy Buds3 Pro",
    priceUsd: 199.99,
    retailer: "samsung.com",
    buyUrl: "#",
    category: "earbuds",
    description:
      "True-wireless earbuds with blade-style design, 24-bit Hi-Fi audio and intelligent ANC.",
    availability: "Only 4 left",
    source: "sandbox",
  },
  {
    id: "sbx-laptop-macbook-air-m3",
    title: 'Apple MacBook Air 13" (M3, 16GB, 512GB)',
    priceUsd: 1299.0,
    retailer: "apple.com",
    buyUrl: "#",
    category: "laptops",
    description:
      "Thin-and-light laptop with the M3 chip, 18-hour battery and a fanless silent design.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-laptop-dell-xps-13",
    title: "Dell XPS 13 (Intel Core Ultra 7, 16GB, 1TB)",
    priceUsd: 1099.99,
    retailer: "dell.com",
    buyUrl: "#",
    category: "laptops",
    description:
      "Compact ultrabook with an InfinityEdge display and all-day battery for work on the go.",
    availability: "Ships in 3-5 days",
    source: "sandbox",
  },
  {
    id: "sbx-laptop-lenovo-thinkpad-x1",
    title: "Lenovo ThinkPad X1 Carbon Gen 12",
    priceUsd: 1549.0,
    retailer: "lenovo.com",
    buyUrl: "#",
    category: "laptops",
    description:
      "Business-class 14-inch laptop with a carbon-fibre chassis, legendary keyboard and vPro security.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-speaker-sonos-era-100",
    title: "Sonos Era 100 Smart Speaker",
    priceUsd: 249.0,
    retailer: "sonos.com",
    buyUrl: "#",
    category: "speakers",
    description:
      "Compact smart speaker with stereo sound, Trueplay tuning and built-in voice control.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-speaker-jbl-charge-5",
    title: "JBL Charge 5 Portable Bluetooth Speaker",
    priceUsd: 149.95,
    retailer: "bestbuy.com",
    buyUrl: "#",
    category: "speakers",
    description:
      "Rugged IP67 waterproof speaker with 20-hour playtime and a built-in powerbank.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-monitor-dell-u2723qe",
    title: 'Dell UltraSharp 27" 4K USB-C Monitor (U2723QE)',
    priceUsd: 579.99,
    retailer: "dell.com",
    buyUrl: "#",
    category: "monitors",
    description:
      "27-inch 4K IPS Black monitor with 90W USB-C power delivery and a built-in KVM.",
    availability: "In stock",
    source: "sandbox",
  },
  {
    id: "sbx-monitor-lg-27gr95qe",
    title: 'LG UltraGear 27" OLED Gaming Monitor (27GR95QE)',
    priceUsd: 796.99,
    retailer: "amazon.com",
    buyUrl: "#",
    category: "monitors",
    description:
      "27-inch 240Hz OLED gaming monitor with 0.03ms response time and G-SYNC compatibility.",
    availability: "Only 2 left",
    source: "sandbox",
  },
] as const;

export interface GetProductsOptions {
  maxPriceUsd?: number;
}

/** Map a normalized Channel3 Offer to a journey Product. */
function offerToProduct(offer: Offer, query: string): Product {
  return {
    ...offer,
    category: query,
    // The UI renders a deterministic generated visual keyed on id; Channel3's
    // normalized Offer carries no image, so leave imageUrl undefined here.
    imageUrl: undefined,
    availability: "In stock",
    source: "channel3",
  };
}

/**
 * Discover products for a query.
 *
 * - Channel3 configured  → live results mapped to Product (source "channel3").
 * - Otherwise            → labelled SANDBOX catalog filtered by query + price.
 *
 * Empty query returns the full set (catalog) / a broad Channel3 search.
 */
export async function getProducts(
  query: string,
  opts: GetProductsOptions = {},
): Promise<ProductSearchResponse> {
  const q = query.trim();
  const { maxPriceUsd } = opts;

  if (process.env.CHANNEL3_API_KEY) {
    const offers = await findOffers(q, { maxPriceUsd, limit: 12 });
    return {
      q,
      source: "channel3",
      products: offers.map((o) => offerToProduct(o, q)),
    };
  }

  // Sandbox path: deterministic demo catalog, clearly labelled source:"sandbox".
  const needle = q.toLowerCase();
  const products = SANDBOX_CATALOG.filter((p) => {
    const matchesQuery =
      needle === "" ||
      p.title.toLowerCase().includes(needle) ||
      p.category.toLowerCase().includes(needle);
    const withinPrice = maxPriceUsd === undefined || p.priceUsd <= maxPriceUsd;
    return matchesQuery && withinPrice;
  });

  return { q, source: "sandbox", products: [...products] };
}
