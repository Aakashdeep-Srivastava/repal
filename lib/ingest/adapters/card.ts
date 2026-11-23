import type { Adapter, RawReward } from "@/lib/ingest/types";

/**
 * Card-linked offers adapter.
 *
 * Per PRD §15, card-linked offers (Amex Offers, Chase, Visa Offers+, etc.) are
 * seeded + labelled rather than pulled live — there is no consumer API for
 * them. This adapter returns deterministic, clearly-labelled SANDBOX offers
 * with realistic messy free-text T&Cs so the ingest pipeline runs offline.
 */

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

export const cardAdapter: Adapter = {
  source: "card",
  async fetch(): Promise<RawReward[]> {
    // SANDBOX / labelled — stand-ins for card-linked offer feeds.
    return [
      {
        source: "card",
        type: "cashback",
        valueUsd: 10,
        expiresAt: inDays(59),
        termsRaw:
          "Amex Offer: Spend $50 or more at participating restaurants and get $10 back. One-time use. Cannot be combined with other dining offers.",
      },
      {
        source: "card",
        type: "cashback",
        valueUsd: 25,
        expiresAt: inDays(30),
        termsRaw:
          "Chase: Earn $25 back on a single purchase of $100+ at Best Buy. Online or in-store. Limited to one statement credit.",
      },
      {
        source: "card",
        type: "percent",
        valueUsd: 0,
        expiresAt: inDays(45),
        termsRaw:
          "Visa Offers+: Get 5% back on electronics purchases, up to $20 total cashback. Valid at select retailers.",
      },
      {
        source: "card",
        type: "cashback",
        valueUsd: 15,
        expiresAt: inDays(20),
        termsRaw:
          "Mastercard: $15 back when you spend $75 or more on headphones or audio accessories. One redemption per cardholder.",
      },
      // Credit/debit-card reward points. Points have no fixed cash value until
      // redeemed (valueUsd 0 — the Terms agent reads the rate from termsRaw); shown
      // so the agent can consider card points alongside coupons. Labelled SANDBOX.
      {
        source: "card",
        type: "points",
        valueUsd: 0,
        expiresAt: inDays(120),
        termsRaw:
          "HDFC Credit Card: 5,000 reward points available. Redeem for statement credit at 1 point = $0.004, or for catalog gift vouchers. Points expire if unused.",
      },
      {
        source: "card",
        type: "points",
        valueUsd: 0,
        expiresAt: inDays(75),
        termsRaw:
          "Debit card rewards: 1,200 points earned this quarter. Redeemable for e-vouchers from partner brands via the rewards portal.",
      },
    ];
  },
};
