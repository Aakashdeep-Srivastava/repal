import Link from "next/link";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import RescuePanel from "@/components/rescue/RescuePanel";

/**
 * /rescue — a Bryntum Scheduler timeline of every active reward's life, so a
 * glance shows what expires when and what to rescue first (red = ≤7 days).
 *
 * Server component: reads the Bryntum license from the RUNTIME env (never
 * build-inlined, never committed) and hands it to the browser-only panel.
 */
export const dynamic = "force-dynamic";

export default function RescuePage() {
  const license = process.env.BRYNTUM_LICENSE ?? "";

  return (
    <main className="hero-aura min-h-dvh">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" aria-label="RePal home" className="shrink-0">
          <RepalLogo size="sm" />
        </Link>
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] sm:gap-5">
          <ThemeToggle />
          <Link href="/wallet" className="hover:text-[var(--color-fg)]">Wallet</Link>
          <Link href="/insights" className="hidden hover:text-[var(--color-fg)] sm:inline">Insights</Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <header className="pt-8">
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Reward <em className="italic text-[var(--color-brand)]">rescue</em> timeline
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)] sm:text-base">
            Every active reward plotted against its expiry. <span className="text-red-400">Red</span> expires within a
            week, <span className="text-amber-400">amber</span> within a month — cash those out or spend them before they
            vanish.
          </p>
        </header>

        <section className="mt-8">
          <RescuePanel license={license} />
        </section>
      </div>
    </main>
  );
}
