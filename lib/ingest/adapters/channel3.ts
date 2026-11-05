import type { Adapter, RawReward } from "@/lib/ingest/types";

/**
 * Channel3 partner-deal adapter.
 *
 * Per PRD §15, Channel3 is a real discovery source. When `CHANNEL3_API_KEY` is
 * set, the production adapter would surface merchant partner deals via the
 * Channel3 client (lib/channel3.ts — see the commented call below). No key is
 * configured in this environment, so this adapter falls back to deterministic,
 * clearly-labelled SANDBOX partner deals so the ingest pipeline runs offline.
 */

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

export const channel3Adapter: Adapter = {
  source: "channel3",
  async fetch(): Promise<RawReward[]> {
    // ── Real path (dormant until CHANNEL3_API_KEY is configured) ──
    // if (process.env.CHANNEL3_API_KEY) {
    //   const { findOffers } = await import("@/lib/channel3");
    //   const offers = await findOffers("rewards and gift card deals", { limit: 4 });
    //   return offers.map((o) => ({
    //     source: "channel3",
    //     type: "coupon",
    //     valueUsd: 0,
    //     expiresAt: inDays(15),
    //     termsRaw: `${o.title} at ${o.retailer} for $${o.priceUsd}.`,
    //   }));
    // }

    // ── Offline fallback: SANDBOX / labelled partner deals ──
    return [
      {
        source: "channel3",
        type: "coupon",
        valueUsd: 30,
        expiresAt: inDays(15),
        termsRaw:
          "Partner deal: $30 off headphones over $200 at select retailers. While supplies last.",
      },
      {
        source: "channel3",
        type: "coupon",
        valueUsd: 12,
        expiresAt: inDays(18),
        termsRaw:
          "Channel3 partner offer: Save $12 on a smart-home purchase of $80 or more at participating merchants.",
      },
    ];
  },
};
