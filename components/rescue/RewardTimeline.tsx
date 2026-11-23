"use client";

import { useMemo } from "react";
import type { WalletReward } from "@/lib/schemas";
import { urgency, expiryLabel, type Urgency } from "@/lib/rewards/rescue";

/**
 * RewardTimeline — a lightweight, dependency-free horizontal timeline of every
 * active reward by expiry date. Replaces the Bryntum Scheduler that was rendering
 * broken on /rescue (its enterprise CSS was clobbered by the global Tailwind
 * reset, collapsing the time axis into a vertical list). This is the right
 * primitive for the job: no third-party CSS to conflict, fully responsive
 * (percentage-positioned), themed via design tokens, and honest — every dot maps
 * to a real reward's real expiry; nothing is invented.
 *
 * Purely presentational. Positions come from the data; colour encodes urgency
 * (red ≤7d, amber 8–30d, blue >30d). Dots are keyboard-focusable and clickable.
 */

const DAY = 86_400_000;

const DOT: Record<Exclude<Urgency, "expired">, string> = {
  critical: "var(--color-danger, #ef4444)",
  soon: "var(--color-warn, #f59e0b)",
  later: "var(--color-brand)",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function RewardTimeline({
  rewards,
  now,
  onSelect,
}: {
  rewards: WalletReward[];
  now: number;
  onSelect?: (rewardId: string) => void;
}) {
  // Fixed 90-day window so near-term (the rescue-relevant) rewards spread out and
  // the month labels never collide. Rewards expiring beyond the window collapse
  // into one "+N later" marker at the right edge instead of piling up off-scale.
  const WINDOW_DAYS = 90;

  const { dots, beyondCount, months, todayPct } = useMemo(() => {
    const withExpiry = rewards
      .map((r) => ({ r, t: new Date(r.expiresAt).getTime() }))
      .filter((x) => Number.isFinite(x.t) && urgency(x.r, now) !== "expired")
      .sort((a, b) => a.t - b.t);

    const start = now - 2 * DAY;
    const end = now + WINDOW_DAYS * DAY;
    const span = end - start;
    const pct = (t: number) => Math.min(98, Math.max(2, ((t - start) / span) * 100));

    const within = withExpiry.filter((x) => x.t <= end);
    const beyondCount = withExpiry.length - within.length;

    const dots = within.map(({ r, t }) => ({
      id: r.id,
      left: pct(t),
      u: urgency(r, now) as Exclude<Urgency, "expired">,
      label: `${expiryLabel(r, now)} · ${r.type}`,
    }));

    // One tick per month inside the 90-day window (≈3 labels → never overlap).
    const months: { left: number; label: string }[] = [];
    const d = new Date(start);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    while (d.getTime() < end) {
      months.push({ left: pct(d.getTime()), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() + 1);
    }

    return { dots, beyondCount, months, todayPct: pct(now) };
  }, [rewards, now]);

  if (dots.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No active rewards with an expiry to plot yet.</p>
    );
  }

  return (
    <div>
      <div className="relative h-20">
        {/* baseline */}
        <div className="absolute left-0 right-0 top-9 h-px bg-[var(--color-border)]" />

        {/* month ticks */}
        {months.map((m) => (
          <div key={m.label} className="absolute top-9 -translate-x-1/2" style={{ left: `${m.left}%` }}>
            <div className="h-2 w-px bg-[var(--color-border)]" />
            <div className="mt-1 whitespace-nowrap text-[10px] font-medium text-[var(--color-muted)]">{m.label}</div>
          </div>
        ))}

        {/* today marker */}
        <div className="absolute top-2 bottom-6 -translate-x-1/2" style={{ left: `${todayPct}%` }}>
          <div className="mx-auto h-full w-px border-l border-dashed border-[var(--color-brand)]" />
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Today
          </span>
        </div>

        {/* reward dots */}
        {dots.map((dot) => (
          <button
            key={dot.id}
            type="button"
            onClick={() => onSelect?.(dot.id)}
            title={dot.label}
            aria-label={dot.label}
            className="group absolute top-9 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--color-card)] transition-transform hover:scale-150 focus:scale-150 focus:outline-none focus-visible:ring-[var(--color-brand)]"
            style={{ left: `${dot.left}%`, backgroundColor: DOT[dot.u] }}
          />
        ))}

        {/* Rewards expiring beyond the 90-day window, summarised at the right edge. */}
        {beyondCount > 0 && (
          <span
            className="absolute top-9 right-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-[color-mix(in_oklab,var(--color-brand)_14%,var(--color-card))] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-brand)]"
            title={`${beyondCount} reward${beyondCount === 1 ? "" : "s"} expiring after 90 days`}
          >
            +{beyondCount} later
          </span>
        )}
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-muted)]">
        <Legend color={DOT.critical} label="Expires ≤ 7 days" />
        <Legend color={DOT.soon} label="Expires in 8–30 days" />
        <Legend color={DOT.later} label="More than 30 days" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
