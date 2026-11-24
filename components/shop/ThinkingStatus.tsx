"use client";

import { useEffect, useState } from "react";

/**
 * Claude-style whimsical "the agent is working" indicator — a pulsing dot plus a
 * word that cycles while the deterministic optimizer + (when configured) the LLM
 * Terms agent do their thing. Purely cosmetic; the real work is elsewhere.
 */
const THINKING_WORDS = [
  "Cerebrating",
  "Discombobulating",
  "Untangling the fine print",
  "Stacking your rewards",
  "Consulting the optimizer",
  "Reticulating splines",
  "Parsing terms & conditions",
  "Haggling with merchants",
  "Computing the cheapest path",
  "Reading the issuer's mood",
  "Cross-checking eligibility",
  "Summoning savings",
];

export function ThinkingStatus({
  words = THINKING_WORDS,
  className = "",
}: {
  words?: string[];
  className?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), 1500);
    return () => clearInterval(t);
  }, [words.length]);

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm text-[var(--color-muted)] ${className}`}
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-brand)] opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-brand)]" />
      </span>
      {/* key forces a remount so the fade-in replays on each word */}
      <span key={i} className="thinking-word font-medium text-[var(--color-fg)]">
        {words[i]}…
      </span>
    </span>
  );
}

export default ThinkingStatus;
