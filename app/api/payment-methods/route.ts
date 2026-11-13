import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getPaymentToken } from "@/lib/paypal/vault";

/**
 * GET /api/payment-methods — the funding the user has authorized RePal to use.
 *
 * HONEST SCOPE: PayPal does NOT expose a buyer's stored cards/bank accounts to a
 * merchant app — there is no API for that (PCI + privacy). The only funding we
 * can read is the payment source the user vaulted to RePal via their spending
 * mandate (the Vault payment token). For a PayPal-wallet token PayPal returns the
 * payer's PayPal account (email), not the underlying card/bank. The UI surfaces
 * this real connected source and labels any card wall as sample.
 */
export async function GET() {
  const { userId } = await getSessionUser();
  const mandate = await prisma.mandate.findFirst({
    where: { userId, status: "active" },
    orderBy: { expiresAt: "desc" },
  });

  if (!mandate?.paypalVaultTokenId) {
    return NextResponse.json({ connected: false, hasMandate: Boolean(mandate) });
  }

  try {
    const t = await getPaymentToken(mandate.paypalVaultTokenId);
    const ps = t.payment_source ?? {};
    const source = ps.card
      ? { type: "card", label: ps.card.brand ?? "Card", detail: ps.card.last_digits ? `•• ${ps.card.last_digits}` : "", status: t.status }
      : { type: "paypal", label: "PayPal", detail: ps.paypal?.email_address ?? "Vault-backed", status: t.status };
    return NextResponse.json({ connected: true, source });
  } catch {
    // Vault read failed (not configured / sandbox hiccup): the mandate exists,
    // so report the connection without funding detail rather than erroring.
    return NextResponse.json({ connected: true, degraded: true, source: { type: "paypal", label: "PayPal", detail: "Vault-backed", status: "ACTIVE" } });
  }
}
