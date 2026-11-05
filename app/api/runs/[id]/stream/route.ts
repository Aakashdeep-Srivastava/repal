import { prisma } from "@/lib/db";

/**
 * GET /api/runs/:id/stream — Server-Sent Events of the run's tool trace + plans.
 *
 * Replays everything persisted for the run (status → each tool_trace in order →
 * the ranked plans → done) as SSE events the UI renders as the agent's live
 * timeline. Written by POST /api/runs via lib/run-trace. OWNER: Aakash.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [run, traces, plans] = await Promise.all([
    prisma.agentRun.findUnique({ where: { id } }),
    prisma.toolTrace.findMany({ where: { runId: id }, orderBy: { at: "asc" } }),
    prisma.plan.findMany({ where: { runId: id } }),
  ]);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("status", run ?? { id, status: "unknown" });
      for (const t of traces) {
        send("trace", { tool: t.tool, kind: t.kind, latencyMs: t.latencyMs, payload: t.payload, at: t.at });
      }
      if (plans.length) send("plans", plans);
      send("done", { id, status: run?.status ?? "unknown", traceCount: traces.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
