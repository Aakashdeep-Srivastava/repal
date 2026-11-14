import { paypalRequest } from "@/lib/paypal/client";

/**
 * PayPal Transaction Search (Reporting API v1) adapter.
 *
 * Pulls REAL settled transactions for the account the API credentials belong to
 * — i.e. RePal's own PayPal (platform/business) account, NOT any individual
 * buyer's wallet. The Reporting API has no notion of "this end-user's history";
 * it reports the authenticated merchant account's activity. Callers MUST label
 * it that way ("RePal's PayPal account activity"), never as a user's own.
 *
 * Caveats baked into the design:
 *  - The "Transaction Search" feature must be enabled on the PayPal app; when it
 *    isn't, PayPal returns a permission error — we surface that as `available:
 *    false` with a reason rather than throwing or faking data.
 *  - Reporting data lags live activity by up to ~3 hours.
 *  - A single request spans at most 31 days.
 *
 * OWNER: Aakash.
 */

export interface PayPalTxn {
  id: string;
  /** ISO date the transaction was initiated. */
  date: string;
  amountUsd: number;
  currency: string;
  /** PayPal transaction status code (S=success, P=pending, D=denied, V=reversed). */
  status: string;
  /** Event code, e.g. T0006 (checkout) / T1107 (refund) — raw PayPal taxonomy. */
  eventCode?: string;
  /** Payer email, when PayPal includes payer_info. */
  payerEmail?: string;
  /** PayPal fee charged on the transaction (USD), when present. */
  feeUsd?: number;
}

export type TransactionSearchResult =
  | { available: true; transactions: PayPalTxn[]; from: string; to: string }
  | { available: false; reason: string };

/** Raw shapes we read from the Reporting API (only the fields we use). */
interface RawTxn {
  transaction_info?: {
    transaction_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_updated_date?: string;
    transaction_status?: string;
    transaction_amount?: { currency_code?: string; value?: string };
    fee_amount?: { currency_code?: string; value?: string };
  };
  payer_info?: { email_address?: string };
}

interface RawResponse {
  transaction_details?: RawTxn[];
  total_items?: number;
}

const num = (v?: string): number => {
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

function normalize(raw: RawTxn): PayPalTxn | null {
  const ti = raw.transaction_info;
  if (!ti?.transaction_id) return null;
  return {
    id: ti.transaction_id,
    date: ti.transaction_initiation_date ?? ti.transaction_updated_date ?? "",
    amountUsd: Math.abs(num(ti.transaction_amount?.value)),
    currency: ti.transaction_amount?.currency_code ?? "USD",
    status: ti.transaction_status ?? "",
    eventCode: ti.transaction_event_code,
    payerEmail: raw.payer_info?.email_address,
    feeUsd: ti.fee_amount ? Math.abs(num(ti.fee_amount.value)) : undefined,
  };
}

/**
 * Search the authenticated account's transactions over a date window.
 * @param days how many days back from now (clamped to PayPal's 31-day max).
 */
export async function searchTransactions(
  opts: { days?: number; pageSize?: number } = {},
): Promise<TransactionSearchResult> {
  const days = Math.min(31, Math.max(1, opts.days ?? 30));
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));

  const now = Date.now();
  const start = new Date(now - days * 86_400_000).toISOString();
  const end = new Date(now).toISOString();

  const qs = new URLSearchParams({
    start_date: start,
    end_date: end,
    fields: "transaction_info,payer_info",
    page_size: String(pageSize),
    page: "1",
  });

  try {
    const res = await paypalRequest<RawResponse>(`/v1/reporting/transactions?${qs}`);
    const transactions = (res.transaction_details ?? [])
      .map(normalize)
      .filter((t): t is PayPalTxn => t !== null)
      // Newest first.
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { available: true, transactions, from: start, to: end };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The Transaction Search feature isn't enabled on this app → permission error.
    if (/\b403\b|NOT_AUTHORIZED|permission|feature/i.test(msg)) {
      return {
        available: false,
        reason:
          "Transaction Search isn't enabled on this PayPal app. Enable it under " +
          "the app's features in the PayPal Developer dashboard to see live account activity.",
      };
    }
    // Missing credentials (sandbox not configured) → honest unavailable state.
    if (/PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET|OAuth/i.test(msg)) {
      return { available: false, reason: "PayPal is not configured in this environment." };
    }
    return { available: false, reason: `PayPal reporting error: ${msg}` };
  }
}

// ─── Balances (Reporting API) ────────────────────────────────────────────

export type BalanceResult =
  | { available: true; currency: string; availableUsd: number; totalUsd: number; withheldUsd: number; asOf?: string }
  | { available: false; reason: string };

interface RawBalance {
  currency?: string;
  total_balance?: { value?: string; currency_code?: string };
  available_balance?: { value?: string; currency_code?: string };
  withheld_balance?: { value?: string; currency_code?: string };
}
interface RawBalanceResponse {
  balances?: RawBalance[];
  as_of_time?: string;
}

/**
 * The authenticated account's PayPal balance (Reporting API). Like
 * Transaction Search, this is RePal's OWN platform/business account balance —
 * the ONLY balance an app can legitimately read (a buyer's funding balance is
 * never exposed). Callers must label it as the account's balance.
 */
export async function getAccountBalance(currency = "USD"): Promise<BalanceResult> {
  try {
    const res = await paypalRequest<RawBalanceResponse>(
      `/v1/reporting/balances?currency_code=${encodeURIComponent(currency)}`,
    );
    const b = (res.balances ?? []).find((x) => (x.currency ?? x.total_balance?.currency_code) === currency)
      ?? res.balances?.[0];
    if (!b) return { available: false, reason: "No balance returned for this account." };
    return {
      available: true,
      currency: b.currency ?? b.available_balance?.currency_code ?? currency,
      availableUsd: num(b.available_balance?.value),
      totalUsd: num(b.total_balance?.value),
      withheldUsd: num(b.withheld_balance?.value),
      asOf: res.as_of_time,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/\b403\b|NOT_AUTHORIZED|permission|feature/i.test(msg)) {
      return { available: false, reason: "Balances reporting isn't enabled on this PayPal app." };
    }
    if (/PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET|OAuth/i.test(msg)) {
      return { available: false, reason: "PayPal is not configured in this environment." };
    }
    return { available: false, reason: `PayPal balance error: ${msg}` };
  }
}
