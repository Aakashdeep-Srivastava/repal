import { NextResponse } from "next/server";

/**
 * GET /api/pay/mode — tells the checkout UI whether a LIVE PayPal integration is
 * configured in this environment. Purely a capability probe: it reads only the
 * PRESENCE of `PAYPAL_CLIENT_ID` and never returns the secret itself.
 *
 * The client uses this to choose the live vs. demo payment path and to label the
 * environment prominently (Live vs. Sandbox / Demo). When PayPal is not
 * configured, the journey falls back to the server-signed demo receipt path
 * (`/api/pay/demo-capture`) — a real, verifiable receipt with NO live capture.
 *
 * OWNER: shopping journey (payment boundary).
 */
export function GET() {
  const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID);
  return NextResponse.json({ paypalConfigured });
}
