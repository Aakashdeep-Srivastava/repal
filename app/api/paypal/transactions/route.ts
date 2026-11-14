import { NextResponse } from "next/server";
import { searchTransactions, getAccountBalance } from "@/lib/paypal/reporting";
import { getSession } from "@/lib/auth/session";
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

  // Gate behind a session — this exposes the account's financial activity
  // (incl. sandbox payer emails), so don't serve it to anonymous visitors.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { available: false, reason: "Sign in to view account activity." },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // Fetch the account balance alongside the transactions (both Reporting API).
  const [result, balance] = await Promise.all([
    searchTransactions({ days: 30, pageSize: 50 }),
    getAccountBalance("USD"),
  ]);
  return NextResponse.json({ ...result, balance }, { headers: rateLimitHeaders(rl) });
}
