"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchMe } from "@/lib/client";

/**
 * AppShell — the consistent product frame: a persistent left sidebar (desktop)
 * and a compact top bar (mobile), with the page content in the main column. This
 * is the reusable navigation system the redesign establishes on /rescue and then
 * carries across Home / Wallet / Discover / Insights.
 *
 * Consumer nav (Home, Wallet, Discover, Rescue, Insights) maps to real routes.
 * The B2B "For Partners" workspace (Campaigns, Publishers) is kept visually
 * SEPARATE and non-navigational until the commercial network is activated — so
 * consumer and merchant workflows never blur, and there are no dead links.
 */

type IconName = "home" | "wallet" | "discover" | "rescue" | "insights";

const NAV: { label: string; href: string; key: IconName }[] = [
  { label: "Home", href: "/", key: "home" },
  { label: "Wallet", href: "/wallet", key: "wallet" },
  { label: "Discover", href: "/shop", key: "discover" },
  { label: "Rescue", href: "/rescue", key: "rescue" },
  { label: "Insights", href: "/insights", key: "insights" },
];

function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
    case "wallet":
      return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case "discover":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
    case "rescue":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" /></svg>;
    case "insights":
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
  }
}

export function AppShell({ active, children }: { active: IconName; children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const name = me?.name?.split(" ")[0];

  const navItem = (item: (typeof NAV)[number]) => {
    const isActive = item.key === active || pathname === item.href;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-[var(--color-brand)] text-white shadow-[var(--shadow-sm)]"
            : "text-[var(--color-muted)] hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] hover:text-[var(--color-fg)]"
        }`}
      >
        <Icon name={item.key} />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] px-4 py-5 lg:flex">
        <Link href="/" aria-label="RePal home" className="px-2">
          <RepalLogo size="sm" />
        </Link>

        <nav className="mt-7 flex flex-col gap-1">{NAV.map(navItem)}</nav>

        {/* B2B workspace — deliberately separated, non-navigational for now. */}
        <div className="mt-6">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">For Partners</p>
          <div className="mt-1 flex flex-col gap-1">
            {["Campaigns", "Publishers"].map((l) => (
              <span
                key={l}
                title="Separate B2B workspace — activates with the commercial network"
                className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--color-muted)] opacity-60"
              >
                {l}
                <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] uppercase">soon</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-brand)_6%,transparent)] p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-fg)]">
              <span className="text-[var(--color-brand)]">✦</span> AI Rewards Agent
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Finds, optimizes and uses your rewards within a signed PayPal mandate.</p>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="truncate text-xs text-[var(--color-muted)]">{name ? `Hi, ${name}` : "Welcome"}</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 lg:hidden">
        <Link href="/" aria-label="RePal home"><RepalLogo size="sm" /></Link>
        <ThemeToggle />
      </header>
      {/* Mobile nav — horizontal, scrollable */}
      <nav className="sticky top-[57px] z-20 flex gap-2 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((item) => {
          const isActive = item.key === active || pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                isActive ? "bg-[var(--color-brand)] text-white" : "border border-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              <Icon name={item.key} className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Main content ── */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
