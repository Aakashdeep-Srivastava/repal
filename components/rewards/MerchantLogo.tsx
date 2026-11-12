// components/rewards/MerchantLogo.tsx
// Real company logos by domain, with a resilient fallback chain so a card never
// renders broken — offline, rate-limited, or for an unknown brand.
//
// Order of preference (all HOTLINKED via <img>, never downloaded/cached — the
// terms every provider here requires; that is also why we use <img>, not
// next/image, which would proxy + cache):
//   1. Local asset  — our own marks (RePal, card networks) in /public/brand.
//   2. Brandfetch   — official brand logos, ~1M req/mo free, NO attribution.
//                     Needs a free client id (NEXT_PUBLIC_BRANDFETCH_CLIENT_ID,
//                     from developers.brandfetch.com). Highest, most consistent
//                     quality — the recommended production source.
//   3. logos.hunter.io / logoapi.sh — free, no key, no signup, no attribution.
//                     So real logos show with ZERO setup (local dev / before a
//                     key is wired). Verified 200 for all 24 catalog merchants.
//   4. Lettermark   — deterministic coloured initial, drawn in-component.
//
// NOT Clearbit (logo API shut down Dec 8 2025). NOT Logo.dev free (requires a
// visible "Logos provided by Logo.dev" link; paid from $300/yr).
"use client";

import { useState } from "react";

type Size = 24 | 32 | 40 | 48 | 64;

const CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;

// Our own marks live locally so they never depend on a third party.
const LOCAL: Record<string, string> = {
  "repal.app": "/brand/repal-monogram.png",
};

/**
 * Ordered list of logo URLs to try for a domain, best quality first. The
 * component walks this list on each <img> error until one loads, else it draws
 * a lettermark. Exported so the ranking/demo code can prefetch if it wants.
 */
export function logoCandidates(domain: string, size: Size = 48): string[] {
  if (LOCAL[domain]) return [LOCAL[domain]];
  const d = encodeURIComponent(domain);
  const px = size * 2; // retina
  const urls: string[] = [];
  // 1. Brandfetch (only when a key is configured). `fallback/404` makes a miss
  //    return 404 so OUR chain advances to the next source instead of showing
  //    Brandfetch's generic lettermark.
  if (CLIENT_ID) {
    urls.push(`https://cdn.brandfetch.io/${d}/w/${px}/h/${px}/fallback/404/icon?c=${CLIENT_ID}`);
  }
  // 2. No-key sources — real logos with zero setup. Two of them for demo
  //    resilience: if one is momentarily down, the other covers.
  urls.push(`https://logos.hunter.io/${d}`);
  urls.push(`https://logoapi.sh/${d}.png`);
  return urls;
}

/** First (best) candidate URL for a domain, or null if none. Back-compat. */
export function logoUrl(domain: string, size: Size = 48): string | null {
  return logoCandidates(domain, size)[0] ?? null;
}

export function MerchantLogo({
  domain, name, size = 40, className = "",
}: { domain: string; name: string; size?: Size; className?: string }) {
  const candidates = logoCandidates(domain, size);
  const [idx, setIdx] = useState(0);
  const radius = Math.round(size * 0.28);
  const src = candidates[idx];

  if (!src) {
    // All sources exhausted (or offline / no key): deterministic lettermark so
    // the card never breaks. Hue is stable per domain.
    const hue = [...domain].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
    return (
      <span
        aria-label={`${name} logo`}
        className={`inline-grid place-items-center font-semibold text-white ${className}`}
        style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.42,
                 background: `oklch(0.55 0.12 ${hue})` }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- hotlink required by provider terms; next/image would proxy+cache
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setIdx((i) => i + 1)} // advance to the next candidate, then lettermark
      className={`bg-white object-contain ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}
