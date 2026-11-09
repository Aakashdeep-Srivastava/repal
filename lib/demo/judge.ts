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
  // shows both the 'allow' and 'ask' paths).
  await prisma.mandate.deleteMany({ where: { userId: JUDGE_USER_ID } });
  const m = await prisma.mandate.create({
    data: {
      userId: JUDGE_USER_ID,
      capUsd: 500,
      budgetUsd: 2000,
      approvalThresholdUsd: 150,
      allowCategories: [],
      allowMerchants: [],
      expiresAt: inDays(90),
      signatureHash: "",
      status: "active",
    },
  });
  await prisma.mandate.update({
    where: { id: m.id },
    data: {
      signatureHash: signMandate(
        {
          id: m.id,
          capUsd: m.capUsd,
          budgetUsd: m.budgetUsd,
          approvalThresholdUsd: m.approvalThresholdUsd,
          allowCategories: m.allowCategories,
          allowMerchants: m.allowMerchants,
          expiresAt: m.expiresAt.toISOString(),
        },
        JUDGE_USER_ID,
      ),
    },
  });

  // Fresh sample wallet.
  await prisma.reward.deleteMany({ where: { userId: JUDGE_USER_ID } });
  await prisma.reward.createMany({
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
  });

  // Clean any prior money artifacts so each judge starts at zero.
  await prisma.receipt.deleteMany({ where: { userId: JUDGE_USER_ID } });
  await prisma.payout.deleteMany({ where: { userId: JUDGE_USER_ID } });
  await prisma.refund.deleteMany({ where: { userId: JUDGE_USER_ID } });
}

/** Reset = re-seed fresh. */
export const resetJudge = seedJudge;
