import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * POST /api/runs — start an agent run from a plain-language goal.
 *
 * Creates the AgentRun row; the orchestrator (agents/orchestrator.ts) then
 * drives the tool chain and streams progress over /api/runs/:id/stream.
 * OWNER: Rachandeep Kaur (run lifecycle) + Aakash (orchestrator wiring).
 */
const Body = z.object({
  userId: z.string().default("demo-user"),
  goal: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const run = await prisma.agentRun.create({
    data: { userId: parsed.data.userId, status: "created", step: "render_intent" },
  });
  // TODO: kick the orchestrator for this run (async) → emits tool_traces + SSE.
  return NextResponse.json({ runId: run.id, status: run.status }, { status: 201 });
}
