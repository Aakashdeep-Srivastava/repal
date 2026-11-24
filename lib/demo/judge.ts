import { prisma } from "@/lib/db";
import type { RewardRule } from "@/lib/types";

/**
 * Judge demo persona — a one-click, self-contained US account so hackathon
 * judges never need their own PayPal/Gmail sandbox. Seeds a signed spending
 * mandate + a small "sample data" wallet. Idempotent; `seedJudge` doubles as the
 * reset (wipes the persona's rewards/mandate and re-creates them fresh).
 *
 * Everything here is clearly SAMPLE DATA (source: "sample") and the UI labels it.
 */
export const JUDGE_USER_ID = "judge-maya";
export const JUDGE_NAME = "Maya (judge demo)";

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

type SampleReward = {
  type: string;
  valueUsd: number;
  termsRaw: string;
  expiresInDays: number;
  rules: RewardRule[];
};

/** US-flavoured sample rewards with DETERMINISTIC rules (parseConfidence 1), so
 * the demo applies + stacks even when the LLM Terms agent is unavailable in prod
 * (it would otherwise leave them unparsed and nothing would auto-apply). The
 * quoted clause on each rule is the reward's own terms — honest grounding.
 * Labelled sample data in the UI. The three reward EFFECTS are represented:
 * instant (gift card, Best Buy coupon, Nike credit), cashback (Chase), points (Starbucks). */
const SAMPLE_REWARDS: SampleReward[] = [
  {
    type: "giftcard", valueUsd: 50, expiresInDays: 5,
    termsRaw: "Target eGiftCard worth $50 — EXPIRES IN 5 DAYS. Redeemable storewide, online or in app.",
    rules: [{ predicate: "merchant_allow", value: ["target.com", "Target"], quotedClause: "Redeemable storewide at Target" }],
  },
  {
    type: "cashback", valueUsd: 20, expiresInDays: 60,
    termsRaw: "Chase Freedom: $20 cash back when you spend $100+ at electronics retailers this quarter.",
    rules: [
      { predicate: "flat_off_usd", value: 20, quotedClause: "$20 cash back" },
      { predicate: "min_spend_usd", value: 100, quotedClause: "when you spend $100+" },
      { predicate: "category_allow", value: ["electronics"], quotedClause: "at electronics retailers" },
    ],
  },
  {
    type: "coupon", valueUsd: 15, expiresInDays: 20,
    termsRaw: "Best Buy: $15 off a purchase of $100 or more. Single use, excludes gift cards.",
    rules: [
      { predicate: "flat_off_usd", value: 15, quotedClause: "$15 off" },
      { predicate: "min_spend_usd", value: 100, quotedClause: "a purchase of $100 or more" },
      { predicate: "merchant_allow", value: ["bestbuy.com", "Best Buy"], quotedClause: "Best Buy" },
    ],
  },
  {
    type: "points", valueUsd: 10, expiresInDays: 120,
    termsRaw: "Starbucks Rewards: 450 Stars (~$10 value) — redeemable on food and drink.",
    rules: [{ predicate: "category_allow", value: ["coffee", "dining"], quotedClause: "redeemable on food and drink" }],
  },
  {
    type: "credit", valueUsd: 30, expiresInDays: 9,
    termsRaw: "Nike Member store credit: $30, valid on full-price items. Expires soon.",
    rules: [{ predicate: "merchant_allow", value: ["nike.com", "Nike"], quotedClause: "Nike Member store credit" }],
  },
];

export async function seedJudge(): Promise<void> {
  await prisma.user.upsert({
    where: { id: JUDGE_USER_ID },
    update: { email: "maya@judge.example.com" },
    create: { id: JUDGE_USER_ID, email: "maya@judge.example.com" },
  });

  // Atomic fresh start: wipe the persona's mandate, wallet and money artifacts
  // in one transaction (safe under concurrent judge-logins). We intentionally
  // seed NO mandate — every user, judge included, goes through the same pivotal
  // "authorize your agent" step before the agent can transact. The sample wallet
  // IS seeded so there's reward value to act on once the mandate is set.
  await prisma.$transaction([
    prisma.mandate.deleteMany({ where: { userId: JUDGE_USER_ID } }),
    prisma.reward.deleteMany({ where: { userId: JUDGE_USER_ID } }),
    prisma.reward.createMany({
      data: SAMPLE_REWARDS.map((r) => ({
        userId: JUDGE_USER_ID,
        source: "sample",
        type: r.type,
        valueUsd: r.valueUsd,
        termsRaw: r.termsRaw,
        rules: r.rules as object[],
        status: "active",
        parseConfidence: 1,
        expiresAt: inDays(r.expiresInDays),
      })),
    }),
    // Clean any prior money artifacts so each judge starts at zero.
    prisma.receipt.deleteMany({ where: { userId: JUDGE_USER_ID } }),
    prisma.payout.deleteMany({ where: { userId: JUDGE_USER_ID } }),
    prisma.refund.deleteMany({ where: { userId: JUDGE_USER_ID } }),
  ]);
}

/** Reset = re-seed fresh. */
export const resetJudge = seedJudge;
