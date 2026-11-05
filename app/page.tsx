"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { PlanCards } from "@/components/PlanCards";
import { requestAgentRun, requestPlan } from "@/lib/client";

function Nav() {
  return (
    <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
      <Link href="/" className="font-semibold tracking-tight">
        Re<span className="text-[var(--color-brand)]">Pal</span>
      </Link>
      <div className="flex items-center gap-5 text-sm text-[var(--color-muted)]">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Agent
        </Link>
        <Link href="/wallet" className="hover:text-[var(--color-fg)]">
          Wallet
        </Link>
      </div>
    </nav>
  );
}

export default function Home() {
  // Input state (local); async/server state lives in TanStack Query mutations.
  const [goal, setGoal] = useState("");
  const [category, setCategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const agent = useMutation({ mutationFn: (g: string) => requestAgentRun(g) });
  const plan = useMutation({
    mutationFn: (v: { category: string; maxPriceUsd?: number }) =>
      requestPlan(v.category, v.maxPriceUsd),
  });

  const agentOut = agent.data ?? null;
  const planOut = plan.data ?? null;

  const runAgent = () => goal.trim() && agent.mutate(goal);
  const findPlans = () =>
    category.trim() &&
    plan.mutate({ category, ...(maxPrice ? { maxPriceUsd: Number(maxPrice) } : {}) });

  return (
    <main className="min-h-dvh">
      <Nav />

      <div className="mx-auto max-w-5xl px-6 pb-24">
        {/* Hero */}
        <header className="pt-8">
          <p className="font-mono text-sm text-[var(--color-brand)]">Re·wards + Pay·Pal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            The cheapest price <em className="not-italic text-[var(--color-brand)]">after</em> your
            rewards.
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--color-muted)]">
            State a goal in plain language. RePal reads your rewards&apos; fine print, a deterministic
            optimizer finds the cheapest SKU after rewards, and PayPal moves the money.
          </p>
        </header>

        {/* Agent */}
        <section className="mt-10 rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-[var(--color-muted)]">Ask the agent</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Your shopping goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAgent()}
              placeholder="noise cancelling headphones under $250"
              className="flex-1 rounded-xl border border-white/15 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
            />
            <button
              onClick={runAgent}
              disabled={agent.isPending}
              className="rounded-xl bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {agent.isPending ? "Running…" : "Run"}
            </button>
          </div>

          {agentOut && (
            <div className="mt-4 text-sm">
              {agentOut.status === "done" ? (
                <p className="whitespace-pre-wrap">{agentOut.answer}</p>
              ) : agentOut.status === "blocked" ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
                  RePal&apos;s AI connects once AWS Bedrock model access is enabled. Meanwhile, try the
                  deterministic optimizer below — it needs no AI.
                </p>
              ) : (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                  {agentOut.error ?? "Something went wrong."}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Deterministic optimizer */}
        <section className="mt-6 rounded-2xl border border-white/10 p-6">
          <h2 className="text-sm font-semibold text-[var(--color-muted)]">
            Try it now — no AI needed
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Product category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findPlans()}
              placeholder="headphones"
              className="flex-1 rounded-xl border border-white/15 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
            />
            <input
              aria-label="Max price USD"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="max $"
              className="w-28 rounded-xl border border-white/15 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
            />
            <button
              onClick={findPlans}
              disabled={plan.isPending}
              className="rounded-xl border border-[var(--color-brand)] px-5 py-3 text-sm font-medium text-[var(--color-brand)] disabled:opacity-60"
            >
              {plan.isPending ? "Finding…" : "Find plans"}
            </button>
          </div>

          <div className="mt-5">
            {planOut?.needsOffers && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                Connect Channel3 (set <code>CHANNEL3_API_KEY</code>) to fetch live offers.
              </p>
            )}
            {planOut?.error && !planOut.needsOffers && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {planOut.error}
              </p>
            )}
            {planOut?.plans && (
              <>
                <p className="mb-3 text-xs text-[var(--color-muted)]">
                  {planOut.offerCount ?? planOut.plans.length} offers considered
                </p>
                <PlanCards plans={planOut.plans} rejected={planOut.rejected} />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
