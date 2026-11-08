"use client";

import { useState } from "react";
import { createMandate } from "@/lib/client";

/**
 * MandateForm — grants RePal a Vault-backed spending mandate: the cap, budget,
 * allow-lists, and approval threshold the agent must obey. On submit we create
 * the signed mandate and, when PayPal returns a Vault approve URL, redirect the
 * buyer to approve the delegated authority. The policy engine enforces every
 * field server-side (lib/policy).
 */

/** Default expiry = 30 days out, as a yyyy-mm-dd string for the date input. */
function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function splitList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function MandateForm({ onCreated }: { onCreated?: () => void }) {
  const [cap, setCap] = useState("200");
  const [budget, setBudget] = useState("1000");
  const [threshold, setThreshold] = useState("100");
  const [categories, setCategories] = useState("");
  const [merchants, setMerchants] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const capUsd = Number(cap);
    const budgetUsd = Number(budget);
    const approvalThresholdUsd = Number(threshold);
    if (!(capUsd > 0) || !(budgetUsd > 0) || !(approvalThresholdUsd > 0)) {
      setError("Cap, budget, and threshold must all be positive amounts.");
      return;
    }
    setBusy(true);
    try {
      const res = await createMandate({
        capUsd,
        budgetUsd,
        approvalThresholdUsd,
        allowCategories: splitList(categories),
        allowMerchants: splitList(merchants),
        expiresAt: new Date(expiresAt + "T00:00:00Z").toISOString(),
      });
      if (res.approveUrl) {
        // Hand off to PayPal to approve the Vault token (delegated authority).
        window.location.href = res.approveUrl;
        return;
      }
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the mandate.");
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]";
  const label = "text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]";

  return (
    <div className="rise rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-2xl font-medium tracking-tight text-[var(--color-fg)]">
        Grant a spending mandate
      </h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
        This is the agent&apos;s delegated authority — a PayPal Vault token scoped by the limits
        you set here. RePal can never spend outside them, and anything above your threshold always
        asks you first.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <span className={label}>Max per purchase</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
            <input className={`${field} pl-7`} inputMode="decimal" value={cap}
              onChange={(e) => setCap(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        </div>
        <div>
          <span className={label}>Total budget</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
            <input className={`${field} pl-7`} inputMode="decimal" value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        </div>
        <div>
          <span className={label}>Ask me above</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
            <input className={`${field} pl-7`} inputMode="decimal" value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>Allowed categories <span className="normal-case opacity-70">(optional, comma-separated)</span></span>
          <input className={field} placeholder="electronics, groceries" value={categories}
            onChange={(e) => setCategories(e.target.value)} />
        </div>
        <div>
          <span className={label}>Allowed merchants <span className="normal-case opacity-70">(optional)</span></span>
          <input className={field} placeholder="bhphotovideo.com, amazon.com" value={merchants}
            onChange={(e) => setMerchants(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 max-w-xs">
        <span className={label}>Expires</span>
        <input type="date" className={field} value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)} />
      </div>

      {error && (
        <p className="mt-4 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-6 w-full rounded-[var(--radius-lg)] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Opening PayPal…" : "Grant mandate with PayPal"}
      </button>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        🔒 You&apos;ll approve a scoped PayPal Vault token. Empty allow-lists mean &ldquo;any
        category / merchant&rdquo;. Revoke anytime.
      </p>
    </div>
  );
}

export default MandateForm;
