"use client";

/**
 * Client boundary for the reward-rescue timeline. Loads the Bryntum Scheduler
 * strictly browser-side (next/dynamic ssr:false — Bryntum crashes under SSR) and
 * feeds it the session user's wallet. The license comes from the server as a
 * prop (runtime env), so nothing secret is inlined at build time.
 */
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RepalLoader from "@/components/brand/RepalLoader";
import { RewardPass } from "@/components/wallet/RewardPass";
import { fetchMe, fetchWallet, type WalletReward } from "@/lib/client";

const RescueTimeline = dynamic(() => import("./RescueTimeline"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-xl border border-[var(--color-border)]">
      <RepalLoader size={40} label="Loading timeline" />
    </div>
  ),
});

export default function RescuePanel({ license }: { license: string }) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const userId = me?.userId ?? "demo-user";
  const { data: rewards, isLoading } = useQuery({
    queryKey: ["wallet", userId],
    queryFn: () => fetchWallet(userId),
  });

  const active = (rewards ?? []).filter(
    (r: WalletReward) => r.status !== "expired" && r.expiresAt,
  );

  // Clicking a bar on the timeline selects that reward to cash out, right here.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const selected = active.find((r) => r.id === selectedId) ?? null;

  if (!license) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        The rescue timeline needs a Bryntum license. Set <code>BRYNTUM_LICENSE</code> to enable it.
      </p>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-[var(--color-border)]">
        <RepalLoader size={40} label="Loading rewards" />
      </div>
    );
  }
  if (active.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">
        No active rewards with an expiry to plot. Log in (try <strong>Judge demo</strong>) or connect sources to fill your wallet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <RescueTimeline rewards={active} license={license} onSelect={onSelect} />
      {selected ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            Cash out this reward
          </p>
          <div className="max-w-md">
            <RewardPass
              reward={selected}
              index={0}
              defaultEmail={me?.email}
              onCashedOut={() => {
                qc.invalidateQueries({ queryKey: ["wallet", userId] });
                setSelectedId(null);
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          👆 Click a reward bar on the timeline to cash it out to PayPal.
        </p>
      )}
    </div>
  );
}
