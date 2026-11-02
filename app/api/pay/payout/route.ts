import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayout } from "@/lib/paypal/payouts";

/** POST /api/pay/payout — reward liberation to the user's PayPal balance. */
const Body = z.object({
  receiverEmail: z.string().email(),
  amountUsd: z.number().positive(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await createPayout(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "payout failed" },
      { status: 502 },
    );
  }
}
