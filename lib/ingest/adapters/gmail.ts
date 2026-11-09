import type { Adapter, RawReward } from "@/lib/ingest/types";
import {
  isGmailConfigured,
  fetchRewardEmails,
  getConnectedEmail,
  guessType,
  hasRewardSignal,
} from "@/lib/ingest/google";

/**
 * Gmail reward adapter (consent-first).
 *
 * When Gmail OAuth is configured AND the user has connected their account, this
 * pulls ONLY reward-looking emails (read-only, reward query) and emits their
 * subject+snippet as free-text T&Cs for the A2 Terms agent to parse — storing
 * nothing else. Otherwise it falls back to clearly-labelled SANDBOX data so the
 * full ingest pipeline still runs offline. See lib/ingest/google.ts.
 */

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

const SAMPLE: RawReward[] = [
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

export const gmailAdapter: Adapter = {
  source: "gmail",
  async fetch(userId: string): Promise<RawReward[]> {
    // Dormant unless configured + connected → labelled sample data.
    if (!isGmailConfigured()) return SAMPLE;
    const connected = await getConnectedEmail(userId);
    if (!connected) return SAMPLE;

    try {
      const emails = await fetchRewardEmails(userId);
      // The agent may read broadly (GMAIL_SCAN_MODE), but we only STORE mail
      // that actually looks like a reward — everything else is dropped here and
      // never persisted. Value is unknown from the email alone (0); the Terms
      // agent extracts amounts/rules from termsRaw; expiry defaults to 60d.
      return emails
        .filter((e) => hasRewardSignal(`${e.subject} ${e.snippet}`))
        .map((e) => ({
          source: "gmail",
          type: guessType(`${e.subject} ${e.snippet}`),
          valueUsd: 0,
          expiresAt: inDays(60),
          termsRaw: `${e.subject} — ${e.snippet}`.slice(0, 1000),
        }));
    } catch {
      // Any Gmail error → safe labelled fallback, never a broken ingest.
      return SAMPLE;
    }
  },
};
