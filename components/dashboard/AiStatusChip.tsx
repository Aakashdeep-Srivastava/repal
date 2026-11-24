"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Header chip showing which AI provider is serving the agent — and, when the
 * fallback chain fails over, a brief whimsical "Switched to Groq — cerebrating…"
 * flash. Reads /api/ai/status (best-effort, per-instance). Hidden when no
 * provider is configured.
 */
type AiStatus = {
  configured: boolean;
  providers: string[];
  primary: string | null;
  active: { provider: string; switchedFrom?: string; at: number } | null;
};

const SWITCH_WORDS = [
  "cerebrating",
  "discombobulating",
  "reticulating",
  "cogitating",
  "recalibrating",
  "vibing",
];

export function AiStatusChip() {
  const { data } = useQuery<AiStatus>({
    queryKey: ["ai-status"],
    queryFn: async () => {
      const r = await fetch("/api/ai/status");
      if (!r.ok) throw new Error("ai status");
      return r.json();
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const lastAt = useRef(0);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    const a = data?.active;
    if (!a?.at || a.at === lastAt.current) return;
    lastAt.current = a.at;
    if (a.switchedFrom) {
      const word = SWITCH_WORDS[Math.floor(a.at / 997) % SWITCH_WORDS.length];
      setFlash(`Switched to ${a.provider} — ${word}…`);
      const t = setTimeout(() => setFlash(null), 4500);
      return () => clearTimeout(t);
    }
  }, [data?.active?.at, data?.active?.provider, data?.active?.switchedFrom]);

  if (!data?.configured) return null;
  const provider = data.active?.provider ?? data.primary ?? "AI";

  return (
    <span
      title={`AI fallback chain: ${(data.providers ?? []).join(" → ")}`}
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium shadow-sm sm:inline-flex ${
        flash
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)]"
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full rounded-full ${flash ? "animate-ping bg-amber-500" : "bg-emerald-500"} opacity-70`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${flash ? "bg-amber-500" : "bg-emerald-500"}`} />
      </span>
      {flash ?? (
        <>
          AI&nbsp;·&nbsp;<span className="text-[var(--color-fg)]">{provider}</span>
        </>
      )}
    </span>
  );
}

export default AiStatusChip;
