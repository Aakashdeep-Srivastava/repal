import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAgent } from "@/agents/orchestrator";

/**
 * POST /api/runs — start an agent run from a plain-language goal.
 *
 * Creates the AgentRun row, then drives the orchestrator (agents/orchestrator.ts)
 * over the Bedrock Claude model: render_intent → plan_purchase (deterministic) →
 * explain. Returns the agent's answer. Degrades gracefully if Bedrock isn't
 * configured yet (status "blocked", not a 500).
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
    data: { userId: parsed.data.userId, status: "running", step: "render_intent" },
  });

  try {
    const result = await runAgent(parsed.data.goal);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "done", step: "complete" },
    });
    return NextResponse.json(
      { runId: run.id, status: "done", answer: result.text },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const blocked = /bedrock/i.test(message);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: blocked ? "blocked" : "error" },
    });
    // Bedrock-not-configured is an expected pre-launch state, not a server fault.
    return NextResponse.json(
      { runId: run.id, status: blocked ? "blocked" : "error", error: message },
      { status: blocked ? 200 : 500 },
    );
  }
}
