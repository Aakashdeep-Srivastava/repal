/**
 * Phase 4 pilot smoke — drives the ENTIRE commercial loop through the REAL network
 * adapter (lib/redemption/affiliate.ts → AffiliateHttpAdapter) against a running HTTP
 * reference partner (lib/partner-ref/handler.ts). Proves confirmation works over real
 * HTTP (bearer auth, JSON, decline path), not just the in-process sandbox.
 *
 *   seed → recordRedemption → confirm OVER HTTP → markPayable (gated) → campaign report
 *
 * Runs against an ISOLATED Neon branch only (never prod). Set DATABASE_URL/DIRECT_URL to
 * the dev branch before running. Usage: npx tsx scripts/phase4-pilot-smoke.ts
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { recordRedemption, reverseRedemption, markPayable } from "../lib/ledger";
import { confirmRedemption, getRedemptionAdapter, hasRealRedemptionNetwork } from "../lib/redemption";
import { summariseCampaign } from "../lib/ledger/campaign-report";
import { handlePartnerRef, parseAction, type PartnerRequestBody } from "../lib/partner-ref/handler";

const prisma = new PrismaClient();
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail));
  }
}

// Guard: refuse to run against the known prod host.
if ((process.env.DATABASE_URL ?? "").includes("ep-old-tooth")) {
  console.error("REFUSING: DATABASE_URL points at prod. Use an isolated Neon branch.");
  process.exit(1);
}

function startReferencePartner(apiKey: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const m = (req.url ?? "").match(/\/redemptions\/(\w+)$/);
    const action = parseAction(m?.[1]);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const authorized = req.headers["authorization"] === `Bearer ${apiKey}`;
      if (!action) {
        res.writeHead(404, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "unknown action" }));
      }
      let body: PartnerRequestBody = {};
      try {
        body = raw ? (JSON.parse(raw) as PartnerRequestBody) : {};
      } catch {
        /* empty */
      }
      const { status, json } = handlePartnerRef(action, body, authorized);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function main() {
  const apiKey = "pilot-ref-key-smoke";
  const partner = await startReferencePartner(apiKey);
  // Point the real adapter at the running reference partner.
  process.env.AFFILIATE_API_URL = partner.url;
  process.env.AFFILIATE_API_KEY = apiKey;
  process.env.AFFILIATE_NETWORK = "refpilot";

  try {
    check("a real (non-sandbox) network is now wired", hasRealRedemptionNetwork() === true);
    const adapter = getRedemptionAdapter();
    check("adapter is the real affiliate adapter, not simulated", adapter.source === "affiliate:refpilot" && adapter.simulated === false, {
      source: adapter.source,
      simulated: adapter.simulated,
    });

    // Clean slate for the pilot users + reset the seeded campaign.
    for (const uid of ["u_phase4", "u_phase4_decline"]) {
      const ids = (await prisma.redemption.findMany({ where: { userId: uid }, select: { id: true } })).map((r) => r.id);
      if (ids.length) {
        await prisma.attribution.deleteMany({ where: { redemptionId: { in: ids } } });
        await prisma.commissionLedger.deleteMany({ where: { redemptionId: { in: ids } } });
        await prisma.customerRewardLedger.deleteMany({ where: { redemptionId: { in: ids } } });
        await prisma.redemption.deleteMany({ where: { id: { in: ids } } });
      }
    }
    await prisma.campaignBudget.update({ where: { id: "camp_texovera" }, data: { spentCents: 0, status: "active" } });

    // 1. Record a redemption from the seeded TexoVera offer (campaign + publisher).
    const r = await recordRedemption(prisma, {
      userId: "u_phase4",
      merchantId: "texovera",
      offerId: "off_texovera_watch",
      code: "4EZ00WAAOQ",
      grossCents: 2_500,
      netPaidCents: 2_000,
      discountCents: 500,
    });

    // 2. Before confirmation: nothing is settleable, campaign shows 0 confirmed.
    const mp0 = await markPayable(prisma);
    check("unconfirmed → markPayable advances nothing", mp0.commissionsMarked === 0 && mp0.cashbackMarked === 0, mp0);

    // 3. Confirm OVER HTTP via the real adapter.
    const conf = await confirmRedemption(prisma, r.redemptionId, adapter);
    check(
      "confirmed over HTTP by the reference partner (non-simulated)",
      conf.confirmed === true && conf.simulated === false && conf.source === "affiliate:refpilot" && conf.confirmationRef === `PARTNER-REF-${r.redemptionId}`,
      conf,
    );

    // 4. After confirmation: the publisher commission becomes payable.
    const mp1 = await markPayable(prisma);
    check("confirmed → markPayable advances the commission", mp1.commissionsMarked >= 1, mp1);

    // 5. Campaign report reflects the confirmed pilot redemption.
    const camp = await prisma.campaignBudget.findUnique({ where: { id: "camp_texovera" } });
    const reds = await prisma.redemption.findMany({
      where: { campaignId: "camp_texovera" },
      select: { id: true, campaignId: true, status: true, confirmedAt: true, netPaidCents: true, discountCents: true },
    });
    const ids = reds.map((x) => x.id);
    const comms = await prisma.commissionLedger.findMany({
      where: { redemptionId: { in: ids } },
      select: { redemptionId: true, party: true, amountCents: true, status: true },
    });
    const cash = await prisma.customerRewardLedger.findMany({
      where: { redemptionId: { in: ids } },
      select: { amountCents: true, status: true },
    });
    const report = summariseCampaign(camp!, reds, comms, cash);
    check("report: 1 confirmed redemption", report.redemptionsConfirmed === 1, report);
    check("report: confirmed GMV = $20", report.gmvCents === 2_000, report);
    check("report: publisher commission payable = 40c", report.commissionPublisherPayableCents === 40, report);
    check("report: media credit kept separate (10000c)", report.mediaCreditCents === 10_000, report);

    // 6. Decline path — the partner declines, so nothing is confirmed/settled.
    const d = await recordRedemption(prisma, {
      userId: "u_phase4_decline",
      merchantId: "texovera",
      code: "DECLINE-ME",
      grossCents: 1_000,
      netPaidCents: 1_000,
      discountCents: 0,
    });
    const declined = await confirmRedemption(prisma, d.redemptionId, adapter);
    check("partner decline → not confirmed, reason surfaced", declined.confirmed === false && declined.reason === "merchant_declined", declined);
    const dRow = await prisma.redemption.findUnique({ where: { id: d.redemptionId } });
    check("declined redemption left unconfirmed", dRow?.confirmedAt === null, dRow);

    // 7. Reversal clears a confirmed redemption's confirmation.
    const rev = await reverseRedemption(prisma, r.redemptionId, "pilot refund");
    check("reversal unwound the confirmed redemption", rev.commissionsReversed >= 1, rev);
    const rRow = await prisma.redemption.findUnique({ where: { id: r.redemptionId } });
    check("reversal cleared confirmation", rRow?.confirmedAt === null, rRow);

    console.log(`\n${failures === 0 ? "ALL PHASE 4 PILOT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  } finally {
    await partner.close();
    await prisma.$disconnect();
  }
  if (failures) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
