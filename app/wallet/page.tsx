"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Reward {
  id: string;
  source: string;
  type: string;
  valueUsd: number;
  termsRaw: string;
  status: string;
  parseConfidence: number;
  expiresAt: string;
}

const usd = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;

function expiryLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days === 0) return "expires today";
  if (days <= 31) return `expires in ${days} day${days === 1 ? "" : "s"}`;
  return `expires ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

const SOURCE_COLORS: Record<string, string> = {
  gmail: "text-red-300 border-red-400/30",
  paypal: "text-sky-300 border-sky-400/30",
  card: "text-violet-300 border-violet-400/30",
  loyalty: "text-amber-300 border-amber-400/30",
  channel3: "text-emerald-300 border-emerald-400/30",
  seed: "text-[var(--color-muted)] border-white/15",
};

export default function WalletPage() {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallet?userId=demo-user")
      .then((r) => r.json())
      .then((d) => setRewards(d.rewards ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="min-h-dvh">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          Re<span className="text-[var(--color-brand)]">Pal</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-[var(--color-muted)]">
          <Link href="/" className="hover:text-[var(--color-fg)]">
            Agent
          </Link>
          <Link href="/wallet" className="text-[var(--color-fg)]">
            Wallet
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <header className="pt-6">
          <h1 className="text-3xl font-semibold tracking-tight">Reward wallet</h1>
          <p className="mt-2 text-[var(--color-muted)]">
            {rewards === null
              ? "Loading your auto-imported rewards…"
              : `${rewards.length} rewards, auto-imported — no manual entry.`}
          </p>
        </header>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards?.map((r) => (
            <div key={r.id} className="flex flex-col rounded-2xl border border-white/10 p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="tnum text-2xl font-semibold">{usd(r.valueUsd)}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    SOURCE_COLORS[r.source] ?? "text-[var(--color-muted)] border-white/15"
                  }`}
                >
                  {r.source}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span className="capitalize">{r.type}</span>
                <span>·</span>
                <span>{expiryLabel(r.expiresAt)}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-[var(--color-muted)]">{r.termsRaw}</p>
            </div>
          ))}
        </div>

        {rewards?.length === 0 && (
          <p className="mt-8 rounded-xl border border-white/10 p-6 text-sm text-[var(--color-muted)]">
            No rewards yet. Seed the database (<code>npm run prisma:seed</code>) or connect a source.
          </p>
        )}
      </div>
    </main>
  );
}
