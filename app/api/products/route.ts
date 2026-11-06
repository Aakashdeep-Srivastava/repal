import { NextResponse } from "next/server";
import { getProducts } from "@/lib/shop/products";
import { Channel3Failure } from "@/lib/channel3";

/** Map a Channel3 failure kind to an HTTP status + stable error code. */
function failureResponse(err: Channel3Failure) {
  const status =
    err.kind === "unauthorized"
      ? 401
      : err.kind === "rate_limited"
        ? 429
        : err.kind === "bad_request"
          ? 400
          : err.kind === "config"
            ? 503
            : 502;
  return NextResponse.json(
    { error: err.message, code: err.kind, provider: "channel3" },
    { status },
  );
}

/**
 * GET /api/products?q=&max= — product discovery for the shopping journey.
 *
 * Thin wrapper over lib/shop/products.getProducts: returns a
 * ProductSearchResponse whose `source` is "channel3" when Channel3 is
 * configured, or "sandbox" (labelled demo data) otherwise. Empty `q` is allowed
 * and returns the full catalog / a broad search.
 *
 * Distinct from GET /api/offers (the deterministic optimizer's Channel3 cache);
 * this one serves the richer Product view and never recomputes money.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const maxRaw = url.searchParams.get("max");
  let maxPriceUsd: number | undefined;
  if (maxRaw !== null && maxRaw !== "") {
    const n = Number(maxRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { error: "`max` must be a positive number" },
        { status: 400 },
      );
    }
    maxPriceUsd = n;
  }

  try {
    const result = await getProducts(q, { maxPriceUsd });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Channel3Failure) return failureResponse(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "product search failed", code: "upstream" },
      { status: 502 },
    );
  }
}
