"use client";

/**
 * Bryntum Scheduler — the "reward rescue" timeline.
 *
 * Browser-only: Bryntum touches the DOM (matchMedia) at import time and crashes
 * under SSR, so this module is loaded exclusively via next/dynamic({ssr:false})
 * from RescuePanel — never on the server. The static imports below are therefore
 * safe (they only ever run in the browser).
 *
 * The license is registered on the `globalThis.bryntum.licenseKey` global (the
 * exact hook Bryntum's LicenseManager reads) BEFORE the Scheduler is created.
 * The key is passed down from the server (runtime env), not inlined at build.
 */
import { useEffect, useRef } from "react";
import { Scheduler } from "@bryntum/scheduler-enterprise";
import "@bryntum/scheduler-enterprise/material3.css";
import type { WalletReward } from "@/lib/client";

const DAY = 86_400_000;

/** Urgency → Bryntum named event color. */
function urgencyColor(daysLeft: number): "red" | "orange" | "green" {
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "orange";
  return "green";
}

function label(r: WalletReward): string {
  const v = r.valueUsd > 0 ? `$${r.valueUsd}` : r.type;
  return `${v} ${r.type}`;
}

export default function RescueTimeline({
  rewards,
  license,
}: {
  rewards: WalletReward[];
  license: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const scheduler = useRef<Scheduler | null>(null);

  useEffect(() => {
    if (!el.current) return;

    // Register the license before any widget is constructed.
    if (license) {
      const g = globalThis as unknown as { bryntum?: { licenseKey?: string } };
      g.bryntum = g.bryntum ?? {};
      g.bryntum.licenseKey = license;
    }

    const now = Date.now();
    const withExpiry = rewards.filter((r) => r.expiresAt);
    const horizon =
      withExpiry.reduce(
        (max, r) => Math.max(max, new Date(r.expiresAt!).getTime()),
        now + 30 * DAY,
      ) + 7 * DAY;

    const resources = withExpiry.map((r) => ({ id: r.id, name: label(r) }));
    const events = withExpiry.map((r) => {
      const exp = new Date(r.expiresAt!).getTime();
      const daysLeft = Math.max(0, Math.round((exp - now) / DAY));
      return {
        id: r.id,
        resourceId: r.id,
        name: `${daysLeft}d left`,
        startDate: new Date(now),
        endDate: new Date(exp),
        eventColor: urgencyColor(daysLeft),
      };
    });

    const s = new Scheduler({
      appendTo: el.current,
      startDate: new Date(now - DAY),
      endDate: new Date(horizon),
      viewPreset: "weekAndDayLetter",
      rowHeight: 48,
      barMargin: 6,
      columns: [{ type: "resourceInfo", text: "Reward", field: "name", width: 200 }],
      resources,
      events,
      // Read-only: this is a rescue view, not an editor.
      readOnly: true,
    });
    scheduler.current = s;

    return () => {
      s.destroy();
      scheduler.current = null;
    };
  }, [rewards, license]);

  return <div ref={el} className="h-[520px] w-full overflow-hidden rounded-xl border border-[var(--color-border)]" />;
}
