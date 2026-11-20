import type { NextConfig } from "next";

/**
 * Production security response headers.
 *
 * Applied to every route by Next (and passed through CloudFront, which caches
 * them with the static HTML). Kept here — in version control — rather than in
 * the CloudFront console so the policy travels with the code and reviews with it.
 *
 * CSP notes:
 *  - `script-src` allows 'unsafe-inline' because this app is statically
 *    prerendered and CDN-cached; a nonce-based CSP would force every page
 *    dynamic and defeat that caching. 'unsafe-inline' still blocks loading
 *    scripts from any *external* origin — the main drive-by XSS vector — it
 *    only permits inline scripts we ship (Next's bootstrap + the no-flash
 *    theme script). Tightening to nonces is a tracked future step.
 *  - `style-src` + `font-src` allow Google Fonts, loaded via <link> in the
 *    root layout and /stack.
 *  - `img-src https:` is intentionally broad: product and merchant-logo images
 *    come from many third-party CDNs (Brandfetch, hunter.io, merchant hosts).
 *    Images cannot execute, so this is low risk.
 *  - `connect-src 'self'`: the browser only ever calls our own /api routes;
 *    PayPal/Google/LLM calls are all server-side.
 */
const isProd = process.env.NODE_ENV === "production";

// Dev needs 'unsafe-eval' for React Fast Refresh / HMR and a ws: connection for
// the HMR socket. Production uses neither — keep it out of the shipped policy.
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
const connectSrc = isProd ? "connect-src 'self'" : "connect-src 'self' ws:";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://www.sandbox.paypal.com https://www.paypal.com https://accounts.google.com",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  connectSrc,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  // 1 year HSTS; the app is only ever reachable over HTTPS (CloudFront).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Standalone output: `next build` emits a self-contained .next/standalone
  // server (its own minimal node_modules) that the Docker runner stage copies.
  // This is what makes the production image small and lets it start with
  // `node server.js` instead of the full `next start` toolchain.
  output: "standalone",

  // Don't advertise the framework/version to attackers probing for CVEs.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Deterministic money logic lives in lib/ and is unit-tested in isolation.
  // Keep server-only packages out of the client bundle here as they are added.
  experimental: {},
};

export default nextConfig;
