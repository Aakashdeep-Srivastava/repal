import type { Adapter, RawReward } from "@/lib/ingest/types";

/**
 * PayPal offers adapter.
 *
 * Per PRD §15, the production adapter would read the connected account's
 * PayPal Offers / cashback deals. No PayPal offers API creds are wired here, so
 * this adapter returns deterministic, clearly-labelled SANDBOX offers that
 * mirror the free-text terms of real PayPal merchant deals, keeping the ingest
 * pipeline fully functional offline.
 */

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

export const paypalAdapter: Adapter = {
  source: "paypal",
  async fetch(): Promise<RawReward[]> {
    // SANDBOX / labelled — stand-ins for live PayPal Offers.
    return [
      {
        source: "paypal",
        type: "cashback",
        valueUsd: 5,
        expiresAt: inDays(25),
        termsRaw:
          "PayPal Offer: $5 back when you pay $30+ with PayPal at participating online stores. One-time.",
      },
      {
        source: "paypal",
        type: "cashback",
        valueUsd: 10,
        expiresAt: inDays(40),
        termsRaw:
          "PayPal Deal: Get $10 statement credit on a purchase of $75 or more at Dell. Limited to one redemption per account.",
      },
      {
        source: "paypal",
        type: "percent",
        valueUsd: 0,
        expiresAt: inDays(60),
        termsRaw:
          "PayPal Rewards: Earn 3% cash back, up to $15, when you check out with PayPal at select travel partners.",
      },
    ];
  },
};
