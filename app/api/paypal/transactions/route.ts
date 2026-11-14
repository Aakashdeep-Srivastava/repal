import { NextResponse } from "next/server";
import { searchTransactions } from "@/lib/paypal/reporting";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/paypal/transactions — live Transaction Search over RePal's own PayPal
 * (platform/business) account. This is NOT the session user's wallet history;
 * the Reporting API only reports the authenticated merchant account's activity,
 * so the UI labels it "RePal's PayPal account activity (sandbox)".
 *
 * Always 200: an unavailable feature / unconfigured env returns
 * `{ available: false, reason }` so the client can show an honest empty state.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "pp-transactions"), 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const result = await searchTransactions({ days: 30, pageSize: 50 });
  return NextResponse.json(result, { headers: rateLimitHeaders(rl) });
}
