import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/paypal/orders";

/** POST /api/pay/order — create an Orders v2 order (pay-in). */
const Body = z.object({
  amountUsd: z.number().positive(),
  description: z.string().optional(),
  vaultId: z.string().optional(), // agent-initiated, no redirect
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const order = await createOrder(parsed.data);
    return NextResponse.json(order);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "order failed" },
      { status: 502 },
    );
  }
}
