"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRewardsFeed, type FeedOffer } from "@/lib/client";
import { InterestPicker } from "./InterestPicker";
import { OfferCard } from "./OfferCard";

/**
 * The cold-start "Discover rewards" feed — the day-one experience for a user
 * with no purchase history. A brand-new user still sees a full wallet:
 *   • Welcome   — the pinned $5 welcome reward (auto-applied)
 *   • For you   — personalised from the 3-tap interest picker (no history needed)
 *   • Popular   — global catalog fallback so the feed is never empty
 *   • Locked    — offers that unlock by connecting Gmail / a card
 *
 * Deterministic server-side (see lib/offers/rank.ts); no LLM in the hot path.
 * When the user hasn't onboarded yet, the InterestPicker takes the lead.
 */
function Section({
  title, subtitle, items, highlight = false, locked = false,
}: {
  title: string;
  subtitle?: string;
  items: FeedOffer[];
  highlight?: boolean;
  locked?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-medium tracking-tight text-[var(--color-fg)]">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <OfferCard
            key={item.offer.id}
            item={item}
            highlight={highlight}
            locked={locked}
          />
        ))}
      </div>
    </section>
  );
}

export function RewardsFeed() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["rewards-feed"],
    queryFn: fetchRewardsFeed,
  });

  if (isLoading) {
    return (
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="mt-10 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
        {error instanceof Error ? error.message : "Couldn't load your rewards feed."}
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-medium tracking-tight text-[var(--color-fg)]">
            Discover rewards
          </h2>
          <p className="mt-1.5 text-[var(--color-muted)]">
            Day-one offers tailored to you — no purchase history needed.
          </p>
        </div>
      </div>

      {/* The 3-tap personalisation signal leads when the user hasn't onboarded. */}
      {!data.onboarded && (
        <div className="mt-6">
          <InterestPicker />
        </div>
      )}

      <Section
        title="Welcome"
        subtitle="Applied automatically"
        items={data.welcome}
        highlight
      />
      <Section
        title="For you"
        subtitle={data.onboarded ? "Based on your interests" : undefined}
        items={data.forYou}
      />
      <Section title="Popular right now" items={data.popular} />
      <Section
        title="Unlock by connecting"
        subtitle="Link a source to reveal rewards you already have"
        items={data.locked}
        locked
      />
    </div>
  );
}
