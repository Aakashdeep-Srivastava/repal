"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { fetchPaymentMethods } from "@/lib/client";
import { I } from "@/components/dashboard/shell";

/** Clearly-labelled SAMPLE funding — PayPal never exposes a buyer's real
 * cards/banks to an app, so the card wall is illustrative (like sample rewards). */
const SAMPLE = [
  { kind: "card", brand: "Visa", last4: "4242", grad: "linear-gradient(135deg,#1a1f71,#2b3fae)" },
  { kind: "card", brand: "Mastercard", last4: "5555", grad: "linear-gradient(135deg,#eb001b,#f79e1b)" },
  { kind: "bank", brand: "Bank account", last4: "6789", grad: "linear-gradient(135deg,#0f766e,#0ea5a0)" },
];

export function PaymentMethods() {
  const { data } = useQuery({ queryKey: ["payment-methods"], queryFn: fetchPaymentMethods, retry: false });
  const connected = data?.connected && data.source;

  return (
    <section className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-brand)]/12 text-[var(--color-brand)]"><I.wallet className="h-5 w-5" /></span>
          <div><h2 className="text-[17px] font-semibold text-[var(--color-fg)]">Payment methods</h2><p className="text-[12.5px] text-[var(--color-muted)]">What RePal can spend against — powered by PayPal Vault.</p></div>
        </div>
        <Link href="/mandate" className="rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5">Manage →</Link>
      </div>

      {/* REAL connected funding (via the PayPal API) */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-brand)]/10"><Image src="/brand/repal-monogram.png" alt="" width={28} height={28} className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          {connected ? (
            <>
              <div className="flex items-center gap-2 text-[14.5px] font-semibold text-[var(--color-fg)]">{data!.source!.label}<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Vault-backed</span></div>
              <div className="truncate text-[12.5px] text-[var(--color-muted)]">{data!.source!.detail || "Connected"} · revocable anytime</div>
            </>
          ) : (
            <>
              <div className="text-[14.5px] font-semibold text-[var(--color-fg)]">No funding connected</div>
              <div className="text-[12.5px] text-[var(--color-muted)]">Set a spending mandate to authorize PayPal as your agent&apos;s payment source.</div>
            </>
          )}
        </div>
        {!connected && <Link href="/mandate" className="rounded-xl bg-[var(--color-brand)] px-4 py-2 text-[13px] font-semibold text-white">Connect</Link>}
      </div>

      {/* SAMPLE linked cards & banks — labelled honestly */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Linked cards &amp; banks</span>
        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600">Sample</span>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {SAMPLE.map((s) => (
          <div key={s.brand + s.last4} className="relative overflow-hidden rounded-2xl p-4 text-white shadow-sm" style={{ background: s.grad }}>
            <div className="flex items-center justify-between"><span className="text-[12px] font-semibold uppercase tracking-wide opacity-90">{s.kind === "bank" ? "Bank" : s.brand}</span>{s.kind === "card" ? <I.wallet className="h-4 w-4 opacity-80" /> : <I.coin className="h-4 w-4 opacity-80" />}</div>
            <div className="mt-6 font-mono text-[15px] tracking-widest">•••• {s.last4}</div>
            <div className="mt-1 text-[11px] opacity-75">{s.kind === "bank" ? "Checking" : "Debit/Credit"} · Sample</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-snug text-[var(--color-muted)]">
        PayPal keeps your real cards &amp; bank accounts private — apps never receive them over the API. RePal only ever sees the revocable Vault token you authorize above; these cards are illustrative.
      </p>
    </section>
  );
}
