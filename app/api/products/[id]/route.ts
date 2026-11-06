import { NextResponse } from "next/server";
import { getChannel3Product, channel3DiscoveryMode, Channel3Failure } from "@/lib/channel3";
import { getSandboxProduct } from "@/lib/shop/products";

/**
 * GET /api/products/[id] — full details for one product by id.
 *
 * Live (channel3) mode fetches fresh details from Channel3 (free, hydrated
 * variants + current offers). Demo mode resolves the labelled sandbox catalog.
 * Enables deep-link / refresh on /product/[id] with real data, since a product
 * id is not guaranteed to appear in a broad catalog search.
 */
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  if (channel3DiscoveryMode() !== "live") {
    const p = getSandboxProduct(id);
    return p
      ? NextResponse.json(p)
      : NextResponse.json({ error: "product not found" }, { status: 404 });
  }

  try {
    const product = await getChannel3Product(id);
    return product
      ? NextResponse.json(product)
      : NextResponse.json({ error: "product not found in this locale" }, { status: 404 });
  } catch (err) {
    if (err instanceof Channel3Failure) return failureResponse(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "product lookup failed", code: "upstream" },
      { status: 502 },
    );
  }
}
