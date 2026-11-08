"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MandateForm } from "@/components/mandate/MandateForm";
import { fetchMandate, revokeMandate, type ActiveMandate } from "@/lib/client";

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function MandateCard({ m, onRevoke, revoking }: { m: ActiveMandate; onRevoke: () => void; revoking: boolean }) {
  const vaultBacked = Boolean(m.paypalVaultTokenId);
  const rows: [string, string][] = [
    ["Max per purchase", usd(m.capUsd)],
    ["Total budget", usd(m.budgetUsd)],
    ["Ask me above", usd(m.approvalThresholdUsd)],
    ["Expires", new Date(m.expiresAt).toLocaleDateString()],
  ];
  return (
    <div className="rise rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[var(--color-fg)]">
          Active mandate
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            vaultBacked
              ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-300"
          }`}
        >
          {vaultBacked ? "🔒 Vault-backed" : "⚠︎ Policy-only"}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{k}</dt>
            <dd className="mt-1 text-lg font-medium tracking-tight text-[var(--color-fg)]">{v}</dd>
          </div>
        ))}
      </dl>

      {(m.allowCategories.length > 0 || m.allowMerchants.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {m.allowCategories.map((c) => (
            <span key={`c-${c}`} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs text-[var(--color-muted)]">
              {c}
            </span>
          ))}
          {m.allowMerchants.map((c) => (
            <span key={`m-${c}`} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs text-[var(--color-muted)]">
              {c}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onRevoke}
        disabled={revoking}
        className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-60"
      >
        {revoking ? "Revoking…" : "Revoke mandate"}
      </button>
    </div>
  );
}

export default function MandatePage() {
  const queryClient = useQueryClient();
  const { data: mandate, isLoading } = useQuery({ queryKey: ["mandate"], queryFn: fetchMandate });
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("granted")) setBanner(p.get("vault") === "failed" ? "vault_failed" : "granted");
    else if (p.get("cancelled")) setBanner("cancelled");
  }, []);

  const revoke = useMutation({
    mutationFn: (id: string) => revokeMandate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mandate"] }),
  });

  return (
    <main className="hero-aura min-h-dvh">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="RePal home" className="shrink-0">
          <RepalLogo size="sm" />
        </Link>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)] sm:gap-5">
          <ThemeToggle />
          <Link href="/" className="hover:text-[var(--color-fg)]">Agent</Link>
          <Link href="/wallet" className="hover:text-[var(--color-fg)]">Wallet</Link>
          <Link href="/mandate" className="text-[var(--color-fg)]">Mandate</Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <header className="pt-8 sm:pt-12">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 font-mono text-xs tracking-wide text-[var(--color-brand)] shadow-sm">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]" />
            Spending mandate
          </p>
          <h1 className="rise font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl" style={{ animationDelay: "60ms" }}>
            Let the agent act — within your limits.
          </h1>
          <p className="rise mt-4 max-w-2xl text-base text-[var(--color-muted)]" style={{ animationDelay: "120ms" }}>
            A mandate is delegated authority: a PayPal Vault token the agent can spend against, but
            only inside the cap, budget, allow-lists, and approval threshold you set.
          </p>
        </header>

        {banner === "granted" && (
          <p className="mt-6 rounded-[var(--radius-md)] border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            ✓ Mandate granted — the agent now has Vault-backed authority within your limits.
          </p>
        )}
        {banner === "vault_failed" && (
          <p className="mt-6 rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">
            Mandate is active (policy-enforced), but the PayPal Vault token couldn&apos;t be
            captured — you can re-grant to attach it.
          </p>
        )}
        {banner === "cancelled" && (
          <p className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-muted)]">
            Vault approval cancelled — no mandate was activated.
          </p>
        )}

        <div className="mt-8">
          {isLoading ? (
            <div className="h-48 animate-pulse rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)]" />
          ) : mandate ? (
            <MandateCard m={mandate} onRevoke={() => revoke.mutate(mandate.id)} revoking={revoke.isPending} />
          ) : (
            <MandateForm onCreated={() => queryClient.invalidateQueries({ queryKey: ["mandate"] })} />
          )}
        </div>
      </div>
    </main>
  );
}
