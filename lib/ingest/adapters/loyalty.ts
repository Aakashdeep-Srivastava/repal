import type { Adapter, RawReward } from "@/lib/ingest/types";

/**
 * Loyalty / points adapter.
 *
 * Per PRD §15, airline-miles / hotel-points / store-rewards balances are seeded
 * + labelled (each loyalty program has its own bespoke API and auth). This
 * adapter returns deterministic, clearly-labelled SANDBOX balances with
 * realistic free-text redemption terms so the ingest pipeline runs offline.
 */

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

export const loyaltyAdapter: Adapter = {
  source: "loyalty",
  async fetch(): Promise<RawReward[]> {
    // SANDBOX / labelled — stand-ins for connected loyalty-program balances.
    return [
      {
        source: "loyalty",
        type: "points",
        valueUsd: 35,
        expiresAt: inDays(180),
        termsRaw:
          "Delta SkyMiles: 3,500 miles (~$35 value) expiring in 6 months. Redeemable for flights or seat upgrades.",
      },
      {
        source: "loyalty",
        type: "points",
        valueUsd: 60,
        expiresAt: inDays(300),
        termsRaw:
          "Amex Membership Rewards: 6,000 points. Transferable to airline partners. Best value for travel.",
      },
      {
        source: "loyalty",
        type: "points",
        valueUsd: 22,
        expiresAt: inDays(40),
        termsRaw:
          "Chase Ultimate Rewards: 2,200 points expiring soon. 1.25x value through the travel portal.",
      },
    ];
  },
};
