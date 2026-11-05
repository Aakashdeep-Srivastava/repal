import type { Adapter, RawReward } from "@/lib/ingest/types";

/**
 * Gmail reward adapter.
 *
 * Per PRD §15, the production adapter would scan a connected Gmail inbox
 * (promotions label) via the Gmail API for gift-card / coupon emails and
 * extract their free-text offer copy. No Google OAuth creds are configured in
 * this environment, so this adapter returns deterministic, clearly-labelled
 * SANDBOX data that mirrors the shape (and messy free-text T&Cs) of real
 * promotional email offers, so the full ingest pipeline runs offline.
 */

// days-from-now → concrete expiry Date (matches prisma/seed.ts).
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

export const gmailAdapter: Adapter = {
  source: "gmail",
  async fetch(): Promise<RawReward[]> {
    // SANDBOX / labelled — stand-ins for parsed promotional emails.
    return [
      {
        source: "gmail",
        type: "giftcard",
        valueUsd: 50,
        expiresAt: inDays(7),
        termsRaw:
          "Target eGiftCard worth $50 — EXPIRES IN 7 DAYS. Use it or lose it. Redeemable storewide.",
      },
      {
        source: "gmail",
        type: "coupon",
        valueUsd: 20,
        expiresAt: inDays(10),
        termsRaw:
          "Welcome coupon: $20 off your first order of $60 or more at Sony Store. Single use, code auto-applied.",
      },
      {
        source: "gmail",
        type: "cashback",
        valueUsd: 15,
        expiresAt: inDays(21),
        termsRaw:
          "Rakuten: Spend $50, get $15 back when you shop through our link at participating electronics stores. One-time bonus.",
      },
    ];
  },
};
