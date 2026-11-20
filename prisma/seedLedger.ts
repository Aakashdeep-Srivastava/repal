/**
 * Seed the commercial ledger with SANITIZED, synthetic demo data (spec §6 + §9).
 *
 * Mirrors the two example offers from the spec — a TexoVera watch coupon and a
 * Cleartrip domestic-flight coupon — as SYNTHETIC demonstration businesses (not
 * the real brands), distributed by two synthetic publishers under revenue-share
 * agreements, each funded by a brand campaign budget. Idempotent (upserts), so
 * it is safe to re-run. Test-only coupon codes.
 *
 * Run against an ISOLATED dev database only:
 *   DATABASE_URL=<dev-branch> npx tsx prisma/seedLedger.ts
 */
import { prisma } from "../lib/db";

async function main() {
  // ── Publishers (coupon distributors) ──────────────────────────────────────
  const publishers = [
    { id: "gpay", name: "Payment-App Offers (demo)", kind: "payment_app" },
    { id: "repal-mail", name: "RePal Newsletter (demo)", kind: "email" },
  ];
  for (const p of publishers) {
    await prisma.publisher.upsert({ where: { id: p.id }, update: p, create: p });
  }

  // ── Merchants / advertisers (synthetic demo businesses) ───────────────────
  const merchants = [
    { id: "texovera", name: "TexoVera (demo)", domain: "texovera.example", category: "electronics", countries: ["US"] },
    { id: "cleartrip", name: "Cleartrip (demo)", domain: "cleartrip.example", category: "travel", countries: ["US"] },
  ];
  for (const m of merchants) {
    await prisma.merchant.upsert({ where: { id: m.id }, update: m, create: m });
  }

  // ── Partner agreements (RePal fee + publisher revenue share, in bps) ──────
  // Idempotency: clear any prior agreements for these publishers, then recreate.
  await prisma.partnerAgreement.deleteMany({ where: { publisherId: { in: ["gpay", "repal-mail"] } } });
  await prisma.partnerAgreement.createMany({
    data: [
      { publisherId: "gpay", merchantId: null, repalFeeBps: 800, revShareBps: 2500 }, // RePal 8%; pub gets 25% of it
      { publisherId: "repal-mail", merchantId: null, repalFeeBps: 600, revShareBps: 1500 }, // RePal 6%; pub gets 15%
    ],
  });

  // ── Campaign budgets (brands fund their own discounts) ────────────────────
  const campaigns = [
    { id: "camp_texovera", merchantId: "texovera", name: "TexoVera Watch Launch", budgetCents: 50_000, mediaCreditCents: 10_000 },
    { id: "camp_cleartrip", merchantId: "cleartrip", name: "Cleartrip Domestic Q1", budgetCents: 100_000, mediaCreditCents: 0 },
  ];
  for (const c of campaigns) {
    await prisma.campaignBudget.upsert({
      where: { id: c.id },
      update: { name: c.name, budgetCents: c.budgetCents, mediaCreditCents: c.mediaCreditCents },
      create: c,
    });
  }

  // ── Non-cash media credit grant (advertising entitlement, never cash) ─────
  const existingGrant = await prisma.mediaCreditLedger.findFirst({
    where: { merchantId: "texovera", campaignId: "camp_texovera", direction: "grant" },
  });
  if (!existingGrant) {
    await prisma.mediaCreditLedger.create({
      data: { merchantId: "texovera", campaignId: "camp_texovera", direction: "grant", amountCents: 10_000, memo: "Launch media allowance (demo)" },
    });
  }

  // ── Redeemable catalog offers with test coupon codes ──────────────────────
  // TexoVera watch: $5 off, prepaid + one-time-use (exclusive), distributed by
  // the payment-app publisher and funded by the TexoVera campaign.
  const texWatchRules = [
    { predicate: "one_time_use", value: true, quotedClause: "Valid once per customer." },
    { predicate: "flat_off_usd", value: 5, quotedClause: "$5 off your prepaid order." },
  ];
  await prisma.catalogOffer.upsert({
    where: { id: "off_texovera_watch" },
    update: {
      code: "4EZ00WAAOQ", publisherId: "gpay", campaignId: "camp_texovera", stackable: false,
      rules: texWatchRules,
    },
    create: {
      id: "off_texovera_watch", merchantId: "texovera", source: "repal", type: "amount_off",
      value: 5, minSpendUsd: 20, maxRewardUsd: 5, audience: "everyone",
      termsRaw: "$5 off your prepaid order. Valid once per customer.",
      rules: texWatchRules, popularity: 50, expiresAt: new Date("2027-01-09T00:00:00Z"),
      isSample: true, code: "4EZ00WAAOQ", publisherId: "gpay", campaignId: "camp_texovera", stackable: false,
    },
  });

  // Cleartrip: 25% off domestic flights (cap $5,000-equiv), distributed by the
  // newsletter publisher and funded by the Cleartrip campaign. Stackable.
  await prisma.catalogOffer.upsert({
    where: { id: "off_cleartrip_flight" },
    update: { code: "CTDOM", publisherId: "repal-mail", campaignId: "camp_cleartrip", stackable: true },
    create: {
      id: "off_cleartrip_flight", merchantId: "cleartrip", source: "affiliate", type: "pct_off",
      value: 25, minSpendUsd: 0, maxRewardUsd: 60, audience: "everyone",
      termsRaw: "25% off domestic flight bookings.",
      rules: [], popularity: 40, expiresAt: new Date("2027-01-07T00:00:00Z"),
      isSample: true, code: "CTDOM", publisherId: "repal-mail", campaignId: "camp_cleartrip", stackable: true,
    },
  });

  const counts = {
    publishers: await prisma.publisher.count(),
    agreements: await prisma.partnerAgreement.count(),
    campaigns: await prisma.campaignBudget.count(),
    offersWithCode: await prisma.catalogOffer.count({ where: { code: { not: null } } }),
    mediaCredits: await prisma.mediaCreditLedger.count(),
  };
  console.log("Commercial ledger seeded:", JSON.stringify(counts));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
