import { NextResponse, type NextRequest } from "next/server";

/**
 * Canonical-host redirect: www.repal.shop → repal.shop (permanent, 308).
 *
 * The authoritative SEO dedup signal is the self-referencing canonical tag
 * (metadataBase pins every canonical to the apex — see app/layout.tsx); this
 * redirect is defense-in-depth. CAVEAT: it only fires if CloudFront forwards
 * the original `Host` header to the origin. If the CDN rewrites Host to the
 * origin name, this is a no-op in production and the canonical tag carries the
 * fix — which is why both exist.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  if (host === "www.repal.shop") {
    const url = req.nextUrl.clone();
    url.protocol = "https";
    url.host = "repal.shop";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static assets and image optimizer; run on everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
