import { NextResponse } from "next/server";
import { listConfiguredSellers } from "@/lib/paypal/merchants";

/**
 * GET /api/pay/mode — tells the checkout UI whether a LIVE PayPal integration is
 * configured in this environment. Purely a capability probe: it reads only the
 * PRESENCE of credentials and never returns a secret itself.
 *
 * The client uses this to choose the live vs. demo payment path and to label the
 * environment prominently (Live vs. Sandbox / Demo). When PayPal is not
 * configured, the journey falls back to the server-signed demo receipt path
 * (`/api/pay/demo-capture`) — a real, verifiable receipt with NO live capture.
 *
 * Phase 2: also reports which sellers are wired (platform + any dedicated per-merchant
 * apps) as booleans only — merchantId, whether it is a dedicated app, and whether its
 * webhook id is set. No client ids, no secrets.
 *
 * OWNER: shopping journey (payment boundary).
 */
export function GET() {
  const sellers = listConfiguredSellers();
  return NextResponse.json({
    paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID),
    sellers,
    dedicatedSellerCount: sellers.filter((s) => s.dedicated).length,
  });
}
