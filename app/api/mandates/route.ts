import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signMandate } from "@/lib/policy/mandate";
import { MandateInputSchema } from "@/lib/schemas";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/auth/session";
import { createSetupToken } from "@/lib/paypal/vault";

/**
 * POST /api/mandates — create a Vault-backed spending mandate (cap, budget,
 * allow-list, approval threshold). DELETE ?id= to revoke.
 *
 * The mandate IS the agent's delegated authority. We:
 *   1. create + persist the signed policy row (owned by the SESSION user), then
 *   2. open a real PayPal Vault setup token so the buyer approves giving RePal a
 *      scoped payment source. The returned approve URL is handed to the client,
 *      which redirects the buyer to PayPal; /api/mandates/vault/callback then
 *      exchanges the approved setup token for a durable payment (vault) token and
 *      flips the mandate to `active`.
 *
 * Graceful fallback: if PayPal isn't configured / the Vault call fails, the
 * mandate is still activated as a signed policy-only mandate (no vault token) so
 * the demo keeps working — the policy gate enforces it either way.
 */
function publicBase(req: Request): string {
  const r = process.env.PAYPAL_OIDC_REDIRECT;
  return r ? new URL(r).origin : new URL(req.url).origin;
}

/** The authority fields in Mandate-contract shape (what signMandate signs). */
function fieldsOf(row: {
  id: string;
  capUsd: number;
  budgetUsd: number;
  approvalThresholdUsd: number;
  allowCategories: string[];
  allowMerchants: string[];
  expiresAt: Date;
  paypalVaultTokenId?: string | null;
}) {
  return {
    id: row.id,
    capUsd: row.capUsd,
    budgetUsd: row.budgetUsd,
    approvalThresholdUsd: row.approvalThresholdUsd,
    allowCategories: row.allowCategories,
    allowMerchants: row.allowMerchants,
    expiresAt: row.expiresAt.toISOString(),
    paypalVaultTokenId: row.paypalVaultTokenId ?? undefined,
  };
}

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "mandates"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = MandateInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
  }
  const d = parsed.data;
  // Ownership comes from the signed session, NOT the client body — a mandate is
  // delegated authority and must bind to the real logged-in user.
  const { userId } = await getSessionUser();

  // 1. Create the pending row (to mint its id). Unsigned + pending until either
  //    the Vault token lands (callback) or we fall back below.
  const row = await prisma.mandate.create({
    data: {
      userId,
      capUsd: d.capUsd,
      budgetUsd: d.budgetUsd,
      approvalThresholdUsd: d.approvalThresholdUsd,
      allowCategories: d.allowCategories,
      allowMerchants: d.allowMerchants,
      expiresAt: new Date(d.expiresAt),
      signatureHash: "",
      status: "pending_vault",
    },
  });

  // 2. Open the real PayPal Vault setup token (buyer approval).
  const base = publicBase(req);
  const returnUrl = `${base}/api/mandates/vault/callback?mandate=${row.id}`;
  const cancelUrl = `${base}/mandate?cancelled=1`;
  try {
    const setup = await createSetupToken(returnUrl, cancelUrl);
    const approveUrl = setup.links?.find(
      (l) => l.rel === "approve" || l.rel === "payer-action",
    )?.href;
    if (!approveUrl) throw new Error("setup token returned no approve link");
    await prisma.mandate.update({
      where: { id: row.id },
      data: { vaultSetupTokenId: setup.id },
    });
    return NextResponse.json(
      { mandateId: row.id, approveUrl },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  } catch {
    // Vault unavailable (PayPal unconfigured / API error) — still activate a
    // signed, enforceable policy-only mandate so the flow never dead-ends.
    const signatureHash = signMandate(fieldsOf(row), userId);
    const activated = await prisma.mandate.update({
      where: { id: row.id },
      data: { signatureHash, status: "active" },
    });
    return NextResponse.json(
      { mandateId: row.id, mandate: activated, vault: "unavailable" },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  }
}

/** GET /api/mandates — the current session user's active mandate (or null). */
export async function GET() {
  const { userId } = await getSessionUser();
  const mandate = await prisma.mandate.findFirst({
    where: { userId, status: "active" },
    orderBy: { expiresAt: "desc" },
  });
  return NextResponse.json({ mandate });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await prisma.mandate.update({ where: { id }, data: { status: "revoked" } });
  return NextResponse.json({ id, status: "revoked" });
}
