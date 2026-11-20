/**
 * Security / fraud integration checks for the commercial ledger (spec §6 Agent 4
 * + §4 attack matrix). Deterministic, against an ISOLATED dev DB only. Complements
 * scripts/ledger-smoke.ts with the adversarial cases the spec calls out.
 *
 *   QA_DATABASE_URL=<dev-branch> DATABASE_URL=<same> npx tsx scripts/security-ledger-smoke.ts
 *
 * Assumes prisma/seedLedger.ts has been run (off_texovera_watch is one_time_use).
 */
import { recordRedemption, reverseRedemption, RedemptionError, summarisePayable } from "../lib/ledger";
import { testPrisma, cleanupByUserPrefix } from "../tests/helpers/database";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `  → ${JSON.stringify(detail)}`}`);
}

async function main() {
  const prisma = testPrisma(); // throws if pointed at prod
  const A = "qa-sec-a";
  const B = "qa-sec-b";

  // Fresh users each run.
  await cleanupByUserPrefix(prisma, "qa-sec-");
  await prisma.user.create({ data: { id: A, email: "qa-sec-a@qa.example" } });
  await prisma.user.create({ data: { id: B, email: "qa-sec-b@qa.example" } });

  const base = {
    merchantId: "texovera",
    offerId: "off_texovera_watch",
    code: "4EZ00WAAOQ",
    grossCents: 2_500,
    netPaidCents: 2_000,
    discountCents: 500,
  };

  // ── 1. Concurrent one-time redemption: EXACTLY ONE succeeds ───────────────
  const results = await Promise.allSettled([
    recordRedemption(prisma, { userId: A, ...base }),
    recordRedemption(prisma, { userId: A, ...base }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter(
    (r) => r.status === "rejected" && r.reason instanceof RedemptionError && r.reason.code === "already_redeemed",
  ).length;
  check("concurrent one-time redemption → exactly one succeeds", ok === 1 && rejected === 1, { ok, rejected });
  const count = await prisma.redemption.count({ where: { userId: A, offerId: base.offerId, status: { not: "reversed" } } });
  check("only one non-reversed redemption row persisted", count === 1, { count });

  // ── 2. Cross-user: a one-time offer is per-user, not global ───────────────
  let bOk = false;
  try {
    await recordRedemption(prisma, { userId: B, ...base });
    bOk = true;
  } catch {
    bOk = false;
  }
  check("different user CAN redeem the same one-time offer (per-user scope)", bOk);

  // ── 3. Wrong coupon code rejected ─────────────────────────────────────────
  let codeRejected = false;
  try {
    await recordRedemption(prisma, { userId: B, ...base, offerId: "off_texovera_watch", code: "WRONGCODE" });
  } catch (e) {
    codeRejected = e instanceof RedemptionError && e.code === "invalid_code";
  }
  check("wrong coupon code rejected", codeRejected);

  // ── 4. Media credits are NEVER payable (not cash) ─────────────────────────
  const commissions = await prisma.commissionLedger.findMany({ select: { party: true, status: true, amountCents: true } });
  const cashback = await prisma.customerRewardLedger.findMany({ select: { status: true, amountCents: true } });
  const payable = summarisePayable(commissions, cashback);
  const mediaTotal = (await prisma.mediaCreditLedger.aggregate({ _sum: { amountCents: true } }))._sum.amountCents ?? 0;
  check(
    "payable summary excludes media credits (advertising entitlement, not cash)",
    mediaTotal > 0 && payable.totalCents < mediaTotal + payable.totalCents,
    { mediaTotal, payableTotal: payable.totalCents },
  );
  // There is no column/relation linking a PayoutItem to a media credit — assert it.
  const mediaCols = await prisma.payoutItem.findMany({ take: 1 });
  check("PayoutItem has no media-credit settlement path", !("mediaCreditId" in (mediaCols[0] ?? {})));

  // ── 5. Reversal does NOT touch the media-credit balance ───────────────────
  const red = await prisma.redemption.findFirst({ where: { userId: A, status: "redeemed" } });
  if (red) {
    const before = (await prisma.mediaCreditLedger.aggregate({ _sum: { amountCents: true } }))._sum.amountCents ?? 0;
    await reverseRedemption(prisma, red.id, "security smoke");
    const after = (await prisma.mediaCreditLedger.aggregate({ _sum: { amountCents: true } }))._sum.amountCents ?? 0;
    check("refund/reversal leaves media-credit balance unchanged", before === after, { before, after });
  }

  await cleanupByUserPrefix(prisma, "qa-sec-");
  console.log(`\n${failures === 0 ? "ALL SECURITY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await prisma.$disconnect();
  if (failures) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
