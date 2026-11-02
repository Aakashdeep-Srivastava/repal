import { NextResponse } from "next/server";
import { z } from "zod";
import { refundCapture } from "@/lib/paypal/refunds";

/** POST /api/pay/refund — reverse a capture (full or partial). */
const Body = z.object({
  captureId: z.string().min(1),
  amountUsd: z.number().positive().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await refundCapture(parsed.data.captureId, parsed.data.amountUsd);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "refund failed" },
      { status: 502 },
    );
  }
}
