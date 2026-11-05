import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAgent } from "@/agents/orchestrator";
import { RunInputSchema } from "@/lib/schemas";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/runs — start an agent run from a plain-language goal.
 *
 * Creates the AgentRun row, then drives the orchestrator (agents/orchestrator.ts)
 * over the Bedrock Claude model: render_intent → plan_purchase (deterministic) →
 * explain. Returns the agent's answer. Degrades gracefully if Bedrock isn't
 * configured yet (status "blocked", not a 500).
 * OWNER: Rachandeep Kaur (run lifecycle) + Aakash (orchestrator wiring).
 */
export async function POST(req: Request) {
  // LLM runs are the most expensive route — tightest limit (10/min/client).
  const rl = rateLimit(clientKey(req, "runs"), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = RunInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
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
