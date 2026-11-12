"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { onboardInterests, type RewardCategory } from "@/lib/client";

/**
 * 3-tap interest picker — the cold-start personalisation signal. A brand-new
 * user has no history, so we ask instead (the Microsoft-News / onboarding
 * pattern). Picking 3 of 12 categories fills the "For you" feed immediately.
 */
const CATEGORIES: { id: RewardCategory; label: string; emoji: string }[] = [
  { id: "electronics", label: "Electronics", emoji: "💻" },
  { id: "dining", label: "Dining", emoji: "🍔" },
  { id: "groceries", label: "Groceries", emoji: "🛒" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "fashion", label: "Fashion", emoji: "👟" },
  { id: "beauty", label: "Beauty", emoji: "💄" },
  { id: "home", label: "Home", emoji: "🛋️" },
  { id: "pets", label: "Pets", emoji: "🐾" },
  { id: "streaming", label: "Streaming", emoji: "🎬" },
  { id: "rides", label: "Rides", emoji: "🚗" },
  { id: "coffee", label: "Coffee", emoji: "☕" },
  { id: "marketplace", label: "Marketplace", emoji: "📦" },
];

const MAX = 3;

export function InterestPicker({ onDone }: { onDone?: () => void }) {
  const [picked, setPicked] = useState<RewardCategory[]>([]);
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: () => onboardInterests(picked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards-feed"] });
      onDone?.();
    },
  });

  const toggle = (id: RewardCategory) =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((c) => c !== id) : cur.length >= MAX ? cur : [...cur, id],
    );

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-2xl font-medium tracking-tight text-[var(--color-fg)]">
        What do you buy most?
      </h2>
      <p className="mt-1.5 text-sm text-[var(--color-muted)]">
        Pick {MAX} — we&apos;ll tailor your rewards. No purchase history needed.
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {CATEGORIES.map((c) => {
          const on = picked.includes(c.id);
          const full = picked.length >= MAX && !on;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={full}
              aria-pressed={on}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                on
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                  : full
                    ? "border-[var(--color-border)] text-[var(--color-muted)] opacity-40"
                    : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-brand)]/50"
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={picked.length !== MAX || submit.isPending}
          className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submit.isPending ? "Setting up…" : `Show my rewards (${picked.length}/${MAX})`}
        </button>
        {submit.error && (
          <span className="text-sm text-red-600 dark:text-red-300">
            {submit.error instanceof Error ? submit.error.message : "Something went wrong"}
          </span>
        )}
      </div>
    </section>
  );
}
