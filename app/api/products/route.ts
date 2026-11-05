import { NextResponse } from "next/server";
import { getProducts } from "@/lib/shop/products";

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "product search failed" },
      { status: 502 },
    );
  }
}
