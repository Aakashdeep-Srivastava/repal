/**
 * Integration smoke for the commercial ledger against an ISOLATED dev DB.
 * Exercises the full redemption lifecycle end-to-end (real Prisma writes), which
 * the pure unit tests cannot: record → campaign depletion → commission split →
 * cashback accrual → attribution → one_time_use guard → invalid_code guard →
 * reversal unwind → balances.
 *
 *   DATABASE_URL=<dev-branch> npx tsx scripts/ledger-smoke.ts
 *
 * NEVER point this at production. Assumes prisma/seedLedger.ts has been run.
 */
import { prisma } from "../lib/db";
import { recordRedemption, reverseRedemption, getBalances, markPayable, RedemptionError } from "../lib/ledger";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  → ${JSON.stringify(detail)}`}`);
}

async function main() {
  const userId = "u_test1"; // seeded sanitized user
  // Clean prior runs of this smoke so it is idempotent.
  const priorRs = await prisma.redemption.findMany({ where: { userId }, select: { id: true } });
  const priorIds = priorRs.map((r) => r.id);
  if (priorIds.length) {
    await prisma.attribution.deleteMany({ where: { redemptionId: { in: priorIds } } });
    await prisma.commissionLedger.deleteMany({ where: { redemptionId: { in: priorIds } } });
    await prisma.customerRewardLedger.deleteMany({ where: { redemptionId: { in: priorIds } } });
    await prisma.redemption.deleteMany({ where: { id: { in: priorIds } } });
  }
  // Reset the TexoVera campaign spend so depletion math is deterministic.
  await prisma.campaignBudget.update({ where: { id: "camp_texovera" }, data: { spentCents: 0, status: "active" } });

  // ── 1. Record a TexoVera watch redemption ($25 gross, $5 off, $20 paid) ───
  const r1 = await recordRedemption(prisma, {
    userId,
    merchantId: "texovera",
    offerId: "off_texovera_watch",
    code: "4EZ00WAAOQ",
    grossCents: 2_500,
    netPaidCents: 2_000,
    discountCents: 500,
    receiptId: "rc_1",
  });
  // gpay agreement: RePal 8% of $20 = 160c; publisher 25% of 160 = 40c; RePal net 120c
  check("commission base = net paid ($20)", r1.commission.baseCents === 2_000, r1.commission);
  check("RePal fee 8% of $20 = 160c", r1.commission.repalFeeCents === 160, r1.commission);
  check("publisher share 25% of fee = 40c", r1.commission.publisherCents === 40, r1.commission);
  check("RePal net = 120c", r1.commission.repalNetCents === 120, r1.commission);
  check("attribution picked up publisher gpay", r1.publisherId === "gpay", r1);
  check("campaign picked up from offer", r1.campaignId === "camp_texovera", r1);

  const camp = await prisma.campaignBudget.findUnique({ where: { id: "camp_texovera" } });
  check("campaign budget depleted by discount ($5)", camp?.spentCents === 500, camp);

  const attr = await prisma.attribution.findUnique({ where: { redemptionId: r1.redemptionId } });
  check("attribution row written (coupon_code model)", attr?.model === "coupon_code", attr);

  const comms = await prisma.commissionLedger.findMany({ where: { redemptionId: r1.redemptionId } });
  check("two commission entries (repal + publisher)", comms.length === 2, comms);

  // ── 2. one_time_use guard — second redemption of the same offer rejected ──
  let blocked = false;
  try {
    await recordRedemption(prisma, {
      userId, merchantId: "texovera", offerId: "off_texovera_watch", code: "4EZ00WAAOQ",
      grossCents: 2_500, netPaidCents: 2_000, discountCents: 500,
    });
  } catch (e) {
    blocked = e instanceof RedemptionError && e.code === "already_redeemed";
  }
  check("one_time_use blocks a second redemption", blocked);

  // ── 3. invalid_code guard ─────────────────────────────────────────────────
  let codeBlocked = false;
  try {
    await recordRedemption(prisma, {
      userId: "u_test2", merchantId: "texovera", offerId: "off_texovera_watch", code: "WRONGCODE",
      grossCents: 2_500, netPaidCents: 2_000, discountCents: 500,
    });
  } catch (e) {
    codeBlocked = e instanceof RedemptionError && e.code === "invalid_code";
  }
  check("wrong coupon code is rejected", codeBlocked);

  // ── 4. Cashback offer accrues a customer liability ────────────────────────
  // Temporarily make a cashback offer: reuse Cleartrip offer by overriding type
  // via a direct redemption with explicit cashback.
  const r2 = await recordRedemption(prisma, {
    userId, merchantId: "cleartrip", offerId: "off_cleartrip_flight", code: "CTDOM",
    grossCents: 8_000, netPaidCents: 6_000, discountCents: 2_000, cashbackCents: 300,
  });
  const crl = await prisma.customerRewardLedger.findMany({ where: { redemptionId: r2.redemptionId } });
  check("cashback liability accrued (300c)", crl.length === 1 && crl[0].amountCents === 300 && crl[0].status === "accrued", crl);

  // ── 5. Balances reflect the ledger ────────────────────────────────────────
  const bal = await prisma.$transaction(async () => getBalances(prisma));
  check("media credit balance = 10000c (seeded grant)", bal.mediaCreditCents === 10_000, bal);
  check("cashback liability balance = 300c", bal.cashbackLiabilityCents === 300, bal);
  // publisher commissions: gpay 40c (texovera) + repal-mail 6% of $60 *15% = floor(360*1500/10000)=54 → 54c
  check("publisher commission payable = 40 + 54 = 94c", bal.commissionPayableCents === 94, bal);

  // ── 6. markPayable advances the lifecycle ─────────────────────────────────
  const mp = await markPayable(prisma);
  check("markPayable advanced commissions + cashback", mp.commissionsMarked >= 1 && mp.cashbackMarked >= 1, mp);

  // ── 7. Reversal unwinds the first redemption ──────────────────────────────
  const rev = await reverseRedemption(prisma, r1.redemptionId, "refund (smoke)");
  check("reversal restored $5 to the campaign budget", rev.budgetRestoredCents === 500, rev);
  const campAfter = await prisma.campaignBudget.findUnique({ where: { id: "camp_texovera" } });
  check("campaign spend back to 0 after reversal", campAfter?.spentCents === 0, campAfter);
  const commsAfter = await prisma.commissionLedger.findMany({ where: { redemptionId: r1.redemptionId } });
  check("reversed redemption's commissions are reversed", commsAfter.every((c) => c.status === "reversed"), commsAfter);

  console.log(`\n${failures === 0 ? "ALL LEDGER INTEGRATION CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await prisma.$disconnect();
  if (failures) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
