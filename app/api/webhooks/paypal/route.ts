import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paypal/webhooks";
import { prisma } from "@/lib/db";

/**
 * POST /api/webhooks/paypal — signature-verified webhook sink.
 *
 * Verifies every event against PayPal (using PAYPAL_WEBHOOK_ID) before trusting
 * it, then persists it. Downstream state (receipt status, payout completion) is
 * driven off these. See docs/TECH_PRD.md §4.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  let verified = false;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (webhookId) {
    try {
      verified = await verifyWebhookSignature(
        {
          authAlgo: req.headers.get("paypal-auth-algo") ?? "",
          certUrl: req.headers.get("paypal-cert-url") ?? "",
          transmissionId: req.headers.get("paypal-transmission-id") ?? "",
          transmissionSig: req.headers.get("paypal-transmission-sig") ?? "",
          transmissionTime: req.headers.get("paypal-transmission-time") ?? "",
        },
        raw,
        webhookId,
      );
    } catch {
      verified = false;
    }
  }

  let event: { id?: string; event_type?: string };
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

  // Always 200 so PayPal doesn't retry a stored-but-unverified event.
  return NextResponse.json({ received: true, verified });
}
