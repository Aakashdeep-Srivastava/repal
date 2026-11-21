import { NextResponse } from "next/server";
import { verifyWebhookForAnySeller } from "@/lib/paypal/webhooks";
import { listConfiguredSellers } from "@/lib/paypal/merchants";
import { prisma } from "@/lib/db";

/**
 * POST /api/webhooks/paypal — signature-verified webhook sink.
 *
 * Phase 2: an inbound webhook may come from any of our configured seller apps, so we
 * try each configured seller's webhook id + credentials until one verifies before
 * trusting the event, then persist it. Downstream state (receipt status, payout
 * completion) is driven off these. See docs/TECH_PRD.md §4.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  let verified = false;
  let verifiedMerchantId: string | null = null;
  const merchantIds = listConfiguredSellers().map((s) => s.merchantId);
  if (merchantIds.length > 0) {
    try {
      const result = await verifyWebhookForAnySeller(
        {
          authAlgo: req.headers.get("paypal-auth-algo") ?? "",
          certUrl: req.headers.get("paypal-cert-url") ?? "",
          transmissionId: req.headers.get("paypal-transmission-id") ?? "",
          transmissionSig: req.headers.get("paypal-transmission-sig") ?? "",
          transmissionTime: req.headers.get("paypal-transmission-time") ?? "",
        },
        raw,
        merchantIds,
      );
      verified = result.verified;
      verifiedMerchantId = result.merchantId;
    } catch {
      verified = false;
    }
  }

  let event: {
    id?: string;
    event_type?: string;
    resource?: {
      id?: string;
      status?: string;
      payout_batch_id?: string;
      transaction_status?: string;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const id = event.id ?? `evt_${Date.now()}`;
  await prisma.webhookEvent.upsert({
    where: { id },
    update: { verified },
    create: {
      id,
      type: event.event_type ?? "UNKNOWN",
      verified,
      raw: JSON.parse(raw),
    },
  });

  // Only act on cryptographically VERIFIED events — never mutate payout/refund
  // state from an unsigned (or unverifiable, e.g. PAYPAL_WEBHOOK_ID unset) body.
  if (verified) {
    await applyEffects(event).catch(() => {});
  }

  // Always 200 so PayPal doesn't retry a stored event.
  return NextResponse.json({ received: true, verified, merchantId: verifiedMerchantId });
}

async function applyEffects(event: {
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    payout_batch_id?: string;
    transaction_status?: string;
  };
}): Promise<void> {
  const type = event.event_type ?? "";
  const r = event.resource ?? {};

  if (type.startsWith("PAYMENT.PAYOUTS-ITEM")) {
    // Reward liberation settled/failed — mirror the item status onto the Payout.
    if (r.payout_batch_id && r.transaction_status) {
      await prisma.payout.updateMany({
        where: { payoutBatchId: r.payout_batch_id },
        data: { status: r.transaction_status },
      });
    }
  } else if (type === "PAYMENT.CAPTURE.REFUNDED" || type.startsWith("PAYMENT.REFUND")) {
    // Refund completed — mirror the refund status onto the Refund row.
    if (r.id && r.status) {
      await prisma.refund.updateMany({ where: { refundId: r.id }, data: { status: r.status } });
    }
  }
}
