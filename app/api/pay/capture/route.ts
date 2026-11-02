import { NextResponse } from "next/server";
import { z } from "zod";
import { captureOrder } from "@/lib/paypal/orders";

/** POST /api/pay/capture — capture a created/approved order. */
const Body = z.object({ orderId: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await captureOrder(parsed.data.orderId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "capture failed" },
      { status: 502 },
    );
  }
}
