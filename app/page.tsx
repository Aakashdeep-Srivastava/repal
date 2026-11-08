"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlanCards } from "@/components/PlanCards";
import { RepalLogo } from "@/components/brand/RepalLogo";
import RepalLoader from "@/components/brand/RepalLoader";
import AgentSearchLoader from "@/components/AgentSearchLoader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requestAgentRun, requestPlan, fetchMe, demoLogin, logout } from "@/lib/client";

function Nav() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const login = useMutation({
    mutationFn: demoLogin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return (
    <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5">
      <Link href="/" aria-label="RePal home" className="shrink-0">
        <RepalLogo size="sm" />
      </Link>
      <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--color-muted)] sm:gap-5">
        <ThemeToggle />
        {/* "Agent" is the home page — redundant on mobile, so hide it there. */}
        <Link href="/" className="hidden hover:text-[var(--color-fg)] sm:inline">
          Agent
        </Link>
        <Link href="/wallet" className="hover:text-[var(--color-fg)]">
          Wallet
        </Link>
        <Link href="/mandate" className="hidden hover:text-[var(--color-fg)] sm:inline">
          Mandate
        </Link>
        <Link href="/insights" className="hidden hover:text-[var(--color-fg)] sm:inline">
          Insights
        </Link>
        {me ? (
          <>
            <span className="hidden max-w-[8rem] truncate text-[var(--color-fg)] sm:inline">
              {me.name ?? me.email ?? me.userId}
            </span>
            <button
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="shrink-0 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-1.5 hover:text-[var(--color-fg)] disabled:opacity-60"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => login.mutate()}
              disabled={login.isPending}
              className="shrink-0 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-1.5 hover:text-[var(--color-fg)] disabled:opacity-60"
            >
              {login.isPending ? "…" : <><span className="sm:hidden">Demo</span><span className="hidden sm:inline">Demo login</span></>}
            </button>
            <a
              href="/api/auth/paypal/login"
              className="shrink-0 whitespace-nowrap rounded-lg bg-[var(--color-brand)] px-3 py-1.5 font-medium text-white"
            >
              <span className="sm:hidden">PayPal</span>
              <span className="hidden sm:inline">Log in with PayPal</span>
            </a>
          </>
        )}
      </div>
    </nav>
  );
}

export default function Home() {
  const router = useRouter();

  // Input state (local); async/server state lives in TanStack Query mutations.
  const [shopQuery, setShopQuery] = useState("");
  const [goal, setGoal] = useState("");
  const [category, setCategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const goShop = () => {
    const q = shopQuery.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  };

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
    <main className="hero-aura min-h-dvh">
      <Nav />

      <div className="mx-auto max-w-5xl px-6 pb-24">
        {/* Hero */}
        <header className="pt-10 sm:pt-14">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 font-mono text-xs tracking-wide text-[var(--color-brand)] shadow-sm">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]" />
            Re·wards + Pay·Pal
          </p>
          <h1
            className="rise font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            The cheapest price <em className="italic text-[var(--color-brand)]">after</em> your
            rewards.
          </h1>
          <p
            className="rise mt-5 max-w-2xl text-base text-[var(--color-muted)] sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            State a goal in plain language. RePal reads your rewards&apos; fine print, a deterministic
            optimizer finds the cheapest SKU after rewards, and PayPal moves the money.
          </p>
        </header>

        {/* Shop — the signature journey entry (search → results → pay). */}
        <section
          className="rise card-hover mt-10 rounded-2xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 p-6 shadow-sm"
          style={{ animationDelay: "180ms" }}
        >
          <h2 className="text-sm font-semibold text-[var(--color-brand)]">Shop with your rewards</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Search a product, see which rewards actually apply, and check out — the cheapest price after rewards.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Shop for a product"
              value={shopQuery}
              onChange={(e) => setShopQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goShop()}
              placeholder="Sony noise-cancelling headphones"
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
            />
            <button
              onClick={goShop}
              className="rounded-xl bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white"
            >
              Start shopping
            </button>
          </div>
        </section>

        {/* Agent */}
        <section className="card card-hover rise mt-6 rounded-2xl p-6" style={{ animationDelay: "240ms" }}>
          <h2 className="text-sm font-semibold text-[var(--color-muted)]">Ask the agent</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Your shopping goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAgent()}
              placeholder="noise cancelling headphones under $250"
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
            />
            <button
              onClick={runAgent}
              disabled={agent.isPending}
              className="rounded-xl bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {agent.isPending ? "Running…" : "Run"}
            </button>
          </div>

          {agent.isPending ? (
            <div className="mt-4">
              <AgentSearchLoader query={goal.trim() || undefined} />
            </div>
          ) : agentOut ? (
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
          ) : null}
        </section>

        {/* Deterministic optimizer */}
        <section className="card card-hover rise mt-6 rounded-2xl p-6" style={{ animationDelay: "300ms" }}>
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
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
            />
            <input
              aria-label="Max price USD"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="max $"
              className="w-28 rounded-xl border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)]"
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
            {plan.isPending && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">
                <RepalLoader size={34} speed={1.6} label="Searching offers" />
                <span>Searching live offers and optimizing the cheapest plan after your rewards…</span>
              </div>
            )}
            {!plan.isPending && planOut?.needsOffers && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                Connect Channel3 (set <code>CHANNEL3_API_KEY</code>) to fetch live offers.
              </p>
            )}
            {!plan.isPending && planOut?.error && !planOut.needsOffers && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {planOut.error}
              </p>
            )}
            {!plan.isPending && planOut?.plans && (
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
      <footer className="mx-auto flex max-w-5xl justify-center gap-6 px-4 pb-10 text-xs text-[var(--color-muted)]">
        <Link href="/privacy" className="hover:text-[var(--color-fg)]">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-[var(--color-fg)]">
          Terms
        </Link>
      </footer>
    </main>
  );
}
