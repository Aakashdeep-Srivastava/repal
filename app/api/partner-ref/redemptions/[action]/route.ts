import { NextResponse } from "next/server";
import { handlePartnerRef, parseAction, type PartnerRequestBody } from "@/lib/partner-ref/handler";

/**
 * POST /api/partner-ref/redemptions/{validate|confirm|reverse}
 *
 * The RUNNING reference partner (see lib/partner-ref/handler.ts). This is the endpoint
 * RePal's own AffiliateHttpAdapter points at when AFFILIATE_API_URL is set to this host —
 * it exercises the entire real-network confirmation path end-to-end.
 *
 * It is a labelled stand-in for a real merchant/affiliate network, NOT a signed partner.
 * Enabled only when PARTNER_REF_API_KEY is set; the caller must present it as a bearer
 * token. A real partner replaces this with their own host implementing the same contract.
 */
export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const key = process.env.PARTNER_REF_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "reference partner disabled (PARTNER_REF_API_KEY unset)" }, { status: 404 });
  }

  const { action: raw } = await ctx.params;
  const action = parseAction(raw);
  if (!action) {
    return NextResponse.json({ error: `unknown action "${raw}"` }, { status: 404 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const authorized = auth === `Bearer ${key}`;

  let body: PartnerRequestBody = {};
  try {
    body = (await req.json()) as PartnerRequestBody;
  } catch {
    /* empty/invalid body — handler treats as missing fields */
  }

  const { status, json } = handlePartnerRef(action, body, authorized);
  return NextResponse.json(json, { status });
}
