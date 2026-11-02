import { prisma } from "@/lib/db";

/**
 * GET /api/runs/:id/stream — Server-Sent Events of tool parts + trace.
 *
 * Skeleton: emits the current run status, then closes. Wire the orchestrator's
 * live tool-call stream here (each tool start/finish → one SSE event).
 * OWNER: Rachandeep Kaur (stream contract shared with the UI).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await prisma.agentRun.findUnique({ where: { id } });

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      send("status", run ?? { id, status: "unknown" });
      // TODO: subscribe to orchestrator events for this run and stream them.
      send("done", { id });
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
