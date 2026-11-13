import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { signMandate } from "@/lib/policy/mandate";

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
};

/** US-flavoured sample rewards — unparsed (rules:[]) so the Terms agent can
 * parse one live on camera. Labelled sample data in the UI. */
const SAMPLE_REWARDS: SampleReward[] = [
  { type: "giftcard", valueUsd: 50, expiresInDays: 5, termsRaw: "Target eGiftCard worth $50 — EXPIRES IN 5 DAYS. Redeemable storewide, online or in app." },
  { type: "cashback", valueUsd: 20, expiresInDays: 60, termsRaw: "Chase Freedom: $20 cash back when you spend $100+ at electronics retailers this quarter." },
  { type: "coupon", valueUsd: 15, expiresInDays: 20, termsRaw: "Best Buy: $15 off a purchase of $100 or more. Single use, excludes gift cards." },
  { type: "points", valueUsd: 0, expiresInDays: 120, termsRaw: "Starbucks Rewards: 450 Stars (~$10 value) — redeemable on food and drink." },
  { type: "credit", valueUsd: 30, expiresInDays: 9, termsRaw: "Nike Member store credit: $30, valid on full-price items. Expires soon." },
];

export async function seedJudge(): Promise<void> {
  await prisma.user.upsert({
    where: { id: JUDGE_USER_ID },
    update: { email: "maya@judge.example.com" },
    create: { id: JUDGE_USER_ID, email: "maya@judge.example.com" },
  });

  // Fresh signed mandate (cap $500, budget $2000, ask above $150 so the demo
  // shows both the 'allow' and 'ask' paths). Pre-generate the id and sign it so
  // the mandate is created ALREADY-SIGNED in one write — no follow-up update
  // that a concurrent re-seed's deleteMany could race into a P2025.
  const mandateId = randomUUID();
  const expiresAt = inDays(90);
  const signatureHash = signMandate(
    {
      id: mandateId,
      capUsd: 500,
      budgetUsd: 2000,
      approvalThresholdUsd: 150,
      allowCategories: [],
      allowMerchants: [],
      expiresAt: expiresAt.toISOString(),
    },
    JUDGE_USER_ID,
  );

  // Atomic re-seed: wipe + recreate the persona's mandate, wallet and money
  // artifacts in a single transaction, so concurrent judge-logins (many judges
  // clicking "Try Live Demo" at once) can't interleave and corrupt each other.
  await prisma.$transaction([
    prisma.mandate.deleteMany({ where: { userId: JUDGE_USER_ID } }),
    prisma.mandate.create({
      data: {
        id: mandateId,
        userId: JUDGE_USER_ID,
        capUsd: 500,
        budgetUsd: 2000,
        approvalThresholdUsd: 150,
        allowCategories: [],
        allowMerchants: [],
        expiresAt,
        signatureHash,
        status: "active",
      },
    }),
    prisma.reward.deleteMany({ where: { userId: JUDGE_USER_ID } }),
    prisma.reward.createMany({
      data: SAMPLE_REWARDS.map((r) => ({
        userId: JUDGE_USER_ID,
        source: "sample",
        type: r.type,
        valueUsd: r.valueUsd,
        termsRaw: r.termsRaw,
        rules: [],
        status: "active",
        parseConfidence: 0,
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
