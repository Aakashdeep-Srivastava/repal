"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MerchantLogo } from "./MerchantLogo";
import { saveOffer, type FeedOffer } from "@/lib/client";

/** Human headline from the offer's type + value. */
function headline(o: FeedOffer["offer"]): string {
  switch (o.type) {
    case "cashback_pct": return `${o.value}% back`;
    case "pct_off": return `${o.value}% off`;
    case "amount_off": return `$${o.value} off`;
    case "welcome_cash": return `$${o.value} welcome reward`;
    case "free_shipping": return "Free shipping";
    default: return `${o.value}`;
  }
}

export function OfferCard({
  item, highlight = false, locked = false,
}: { item: FeedOffer; highlight?: boolean; locked?: boolean }) {
  const queryClient = useQueryClient();
  const { offer, merchant, why, estValueUsd, saved, isSample } = item;

  const save = useMutation({
    mutationFn: () => saveOffer(offer.id, "user"),
    onSuccess: () => {
      // A saved offer becomes a Reward row, so refresh both the feed (card moves
      // to "saved") and the wallet grid (the new pass appears).
      queryClient.invalidateQueries({ queryKey: ["rewards-feed"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  const isWelcome = offer.audience === "new_user";
  const needsGmail = offer.audience === "requires_gmail";

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-[var(--radius-xl)] border p-4 shadow-sm transition-shadow hover:shadow-md ${
        highlight || isWelcome
          ? "border-[var(--color-brand)]/40 bg-[var(--color-brand)]/[0.04]"
          : "border-[var(--color-border)] bg-[var(--color-card)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <MerchantLogo domain={merchant.domain} name={merchant.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-fg)]">{merchant.name}</p>
          <p className="font-display text-lg font-medium leading-tight text-[var(--color-fg)]">
            {headline(offer)}
          </p>
        </div>
        {estValueUsd > 0 && (
          <span className="tnum shrink-0 rounded-full bg-[var(--color-brand)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-brand)]">
            up to ${estValueUsd.toFixed(estValueUsd % 1 ? 2 : 0)}
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)]">{why}</p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {isSample && (
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              Sample offer
            </span>
          )}
          {offer.expiresInDays <= 7 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              {offer.expiresInDays}d left
            </span>
          )}
        </div>

        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)]">
            <span aria-hidden>🔒</span>
            {needsGmail ? "Connect Gmail" : "Link a card"}
          </span>
        ) : isWelcome ? (
          <span className="text-xs font-medium text-[var(--color-brand)]">Auto-applied</span>
        ) : saved ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Saved</span>
        ) : (
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-full border border-[var(--color-brand)] px-4 py-1.5 text-xs font-medium text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/5 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
