/**
 * Seed — a demo user + mandate + 17 cross-network sample rewards.
 *
 * Each reward carries its own free-text `termsRaw`; `rules` is left empty so the
 * Terms agent (A2) parses them on first run (parseConfidence 0 = "unparsed").
 * See docs/TECH_PRD.md §15. Idempotent — safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
import { signMandate } from "@/lib/policy/mandate";

const prisma = new PrismaClient();

const DEMO_USER_ID = "demo-user";

// days-from-now → ISO Date
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

type SeedReward = {
  source: "gmail" | "paypal" | "card" | "loyalty" | "channel3" | "seed";
  type: string;
  valueUsd: number;
  termsRaw: string;
  expiresInDays: number;
  status?: string;
};

const REWARDS: SeedReward[] = [
  // ─── Card-linked offers (seeded + labelled) ───
  { source: "card", type: "cashback", valueUsd: 10, expiresInDays: 59,
    termsRaw: "Amex Offer: Spend $50 or more at participating restaurants and get $10 back. One-time use. Cannot be combined with other dining offers." },
  { source: "card", type: "cashback", valueUsd: 25, expiresInDays: 30,
    termsRaw: "Chase: Earn $25 back on a single purchase of $100+ at Best Buy. Online or in-store. Limited to one statement credit." },
  { source: "card", type: "percent", valueUsd: 0, expiresInDays: 45,
    termsRaw: "Visa Offers+: Get 5% back on electronics purchases, up to $20 total cashback. Valid at select retailers." },
  { source: "card", type: "cashback", valueUsd: 15, expiresInDays: 20,
    termsRaw: "Mastercard: $15 back when you spend $75 or more on headphones or audio accessories. One redemption per cardholder." },
  { source: "card", type: "cashback", valueUsd: 8, expiresInDays: 90,
    termsRaw: "Discover: 5% Cashback Bonus on online shopping this quarter, up to $75 spend. Activation required." },
  { source: "card", type: "cashback", valueUsd: 12, expiresInDays: 14,
    termsRaw: "RuPay Offer: Flat ₹1000 cashback on international spends above $120 (approx). Settles to statement. One-time." },

  // ─── Gift cards / certificates ───
  { source: "seed", type: "giftcard", valueUsd: 40, expiresInDays: 73,
    termsRaw: "$40 Best Buy gift certificate. Redeemable on electronics only. Expires in about 10 weeks." },
  { source: "seed", type: "giftcard", valueUsd: 25, expiresInDays: 120,
    termsRaw: "$25 Amazon gift card. No minimum purchase. Not redeemable for cash." },
  { source: "gmail", type: "giftcard", valueUsd: 50, expiresInDays: 7,
    termsRaw: "Target eGiftCard worth $50 — EXPIRES IN 7 DAYS. Use it or lose it. Redeemable storewide." },
  { source: "gmail", type: "coupon", valueUsd: 20, expiresInDays: 10,
    termsRaw: "Welcome coupon: $20 off your first order of $60 or more at Sony Store. Single use, code auto-applied." },

  // ─── Loyalty / points ───
  { source: "loyalty", type: "points", valueUsd: 35, expiresInDays: 180,
    termsRaw: "Delta SkyMiles: 3,500 miles (~$35 value) expiring in 6 months. Redeemable for flights or seat upgrades." },
  { source: "loyalty", type: "points", valueUsd: 18, expiresInDays: 365,
    termsRaw: "Starbucks Rewards: 300 Stars. Redeem for food & drinks. Keep for travel? No — in-store only." },
  { source: "loyalty", type: "points", valueUsd: 60, expiresInDays: 300,
    termsRaw: "Amex Membership Rewards: 6,000 points. Transferable to airline partners. Best value for travel." },
  { source: "loyalty", type: "points", valueUsd: 22, expiresInDays: 40,
    termsRaw: "Chase Ultimate Rewards: 2,200 points expiring soon. 1.25x value through the travel portal." },

  // ─── PayPal / merchant offers ───
  { source: "paypal", type: "cashback", valueUsd: 5, expiresInDays: 25,
    termsRaw: "PayPal Offer: $5 back when you pay $30+ with PayPal at participating online stores. One-time." },
  { source: "channel3", type: "coupon", valueUsd: 30, expiresInDays: 15,
    termsRaw: "Partner deal: $30 off headphones over $200 at select retailers. While supplies last." },

  // ─── International ───
  { source: "seed", type: "coupon", valueUsd: 14, expiresInDays: 50,
    termsRaw: "AliExpress international coupon: $14 off orders over $100 shipped to the US. New customers only." },
];

async function main() {
  // Demo user
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: { id: DEMO_USER_ID, email: "maya@example.com" },
  });

  // Mandate (Vault token filled later by the real flow). Reset deterministically
  // each seed so the demo mandate stays in sync. allowCategories is empty =
  // "allow any category" (the policy engine only category-gates when the list is
  // non-empty), so the shopping journey isn't blocked by product category; the
  // amount caps still apply. With approvalThresholdUsd = 300, cheaper plans
  // resolve to `allow` and pricier ones to `ask` — the demo shows both paths.
  await prisma.mandate.deleteMany({ where: { userId: DEMO_USER_ID } });
  const seedMandate = await prisma.mandate.create({
    data: {
      userId: DEMO_USER_ID,
      capUsd: 2000,
      budgetUsd: 2000,
      approvalThresholdUsd: 300,
      allowCategories: [],
      allowMerchants: [],
      expiresAt: inDays(90),
      signatureHash: "",
      status: "active",
    },
  });
  // Sign it with the real key so the server-side gate (verifyMandate) honors it.
  await prisma.mandate.update({
    where: { id: seedMandate.id },
    data: {
      signatureHash: signMandate(
        {
          id: seedMandate.id,
          capUsd: seedMandate.capUsd,
          budgetUsd: seedMandate.budgetUsd,
          approvalThresholdUsd: seedMandate.approvalThresholdUsd,
          allowCategories: seedMandate.allowCategories,
          allowMerchants: seedMandate.allowMerchants,
          expiresAt: seedMandate.expiresAt.toISOString(),
        },
        DEMO_USER_ID,
      ),
    },
  });

  // Rewards — reset the demo user's wallet, then load the 17.
  await prisma.reward.deleteMany({ where: { userId: DEMO_USER_ID } });
  await prisma.reward.createMany({
    data: REWARDS.map((r) => ({
      userId: DEMO_USER_ID,
      source: r.source,
      type: r.type,
      valueUsd: r.valueUsd,
      termsRaw: r.termsRaw,
      rules: [], // Terms agent (A2) fills these on first run
      status: r.status ?? "active",
      parseConfidence: 0,
      expiresAt: inDays(r.expiresInDays),
    })),
  });

  const count = await prisma.reward.count({ where: { userId: DEMO_USER_ID } });
  console.log(`✓ Seeded demo user + mandate + ${count} rewards.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
