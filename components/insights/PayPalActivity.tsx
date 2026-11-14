"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPayPalTransactions, type PayPalTxnRow } from "@/lib/client";

/**
 * PayPalActivity — a live view of RePal's OWN PayPal (platform) account via the
 * Transaction Search / Reporting API. This is deliberately framed as the
 * *account's* activity, not the signed-in user's wallet, because the Reporting
 * API only reports the authenticated merchant account's transactions. It sits
 * alongside the user's signed receipts to show the money actually settling at
 * PayPal — distinct, and honestly labelled.
 *
 * Honest states:
 *  - feature not enabled / env not configured → a clear note (no fake rows).
 *  - available but empty (sandbox lag up to ~3h, or no activity) → empty note.
 */

const usd = (n: number, ccy = "USD") =>
  `${ccy === "USD" ? "$" : ""}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** A compact, human label for the common PayPal event-code families. */
function eventLabel(code?: string): string {
  if (!code) return "Payment";
  if (code.startsWith("T00")) return "Payment";
  if (code.startsWith("T03")) return "Transfer";
  if (code.startsWith("T04")) return "Payout";
  if (code.startsWith("T05") || code.startsWith("T11")) return "Refund / reversal";
  if (code.startsWith("T12")) return "Dispute / chargeback";
  return "Transaction";
}

/** PayPal status code → tone + label. */
function statusMeta(s: string): { label: string; cls: string } {
  switch (s) {
    case "S":
      return { label: "Success", cls: "text-[var(--color-teal)]" };
    case "P":
      return { label: "Pending", cls: "text-amber-500" };
    case "D":
      return { label: "Denied", cls: "text-red-500" };
    case "V":
      return { label: "Reversed", cls: "text-[var(--color-muted)]" };
    default:
      return { label: s || "—", cls: "text-[var(--color-muted)]" };
  }
}

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " · " +
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted)]">
      {children}
    </p>
  );
}

function Row({ t }: { t: PayPalTxnRow }) {
  const st = statusMeta(t.status);
  return (
    <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-3 text-sm first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--color-fg)]">{eventLabel(t.eventCode)}</p>
        <p className="truncate font-mono text-xs text-[var(--color-muted)]">
          {t.id}
          {t.payerEmail ? ` · ${t.payerEmail}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-xs text-[var(--color-muted)]">{fmtDate(t.date)}</span>
      <span className={`shrink-0 text-xs font-medium ${st.cls}`}>{st.label}</span>
      <span className="tnum shrink-0 w-24 text-right font-medium text-[var(--color-fg)]">
        {usd(t.amountUsd, t.currency)}
      </span>
    </div>
  );
}

export function PayPalActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ["paypal-transactions"],
    queryFn: fetchPayPalTransactions,
    staleTime: 60_000,
  });

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">
          RePal&apos;s PayPal account activity
        </h2>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
          Sandbox
        </span>
        <span className="rounded-full border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">
          Live via Transaction Search API
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
        Settled transactions on RePal&apos;s own PayPal account (not your wallet), pulled live
        from PayPal&apos;s Reporting API. Data can lag live activity by up to ~3 hours.
      </p>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]" />
        ) : !data ? (
          <Note>Couldn&apos;t load PayPal activity.</Note>
        ) : !data.available ? (
          <Note>{data.reason}</Note>
        ) : data.transactions.length === 0 ? (
          <Note>
            No settled transactions in the last 30 days yet. New sandbox payments can take up
            to ~3 hours to appear in Transaction Search.
          </Note>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
            {data.transactions.slice(0, 12).map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default PayPalActivity;
