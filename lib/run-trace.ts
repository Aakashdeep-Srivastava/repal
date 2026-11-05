import { prisma } from "@/lib/db";

/**
 * Persist an agent run's artifacts — one tool_trace per tool call, and the
 * ranked plans — from a ToolLoopAgent result. Defensive: the SDK result shape
 * is read loosely so an unexpected step shape never breaks the run. These rows
 * are what GET /api/runs/:id/stream replays to the UI. OWNER: Aakash.
 */

interface ToolCallLike {
  toolCallId?: string;
  input?: unknown;
}
interface ToolResultLike {
  toolCallId?: string;
  toolName?: string;
  output?: unknown;
}
interface StepLike {
  toolCalls?: ToolCallLike[];
  toolResults?: ToolResultLike[];
}

function stepsOf(result: unknown): StepLike[] {
  const s = (result as { steps?: unknown }).steps;
  return Array.isArray(s) ? (s as StepLike[]) : [];
}

export async function persistRunArtifacts(runId: string, result: unknown): Promise<void> {
  const steps = stepsOf(result);

  const traces = steps.flatMap((step) =>
    (step.toolResults ?? []).map((tr) => {
      const call = (step.toolCalls ?? []).find((c) => c.toolCallId === tr.toolCallId);
      return {
        runId,
        tool: String(tr.toolName ?? "tool"),
        kind: "tool",
        latencyMs: 0,
        payload: { input: call?.input ?? null, output: tr.output ?? null } as object,
      };
    }),
  );
  if (traces.length) await prisma.toolTrace.createMany({ data: traces });

  // Persist the ranked plans from the plan_purchase tool output, if present.
  const planOutput = steps
    .flatMap((s) => s.toolResults ?? [])
    .find((tr) => tr.toolName === "plan_purchase")?.output as
    | { plans?: Array<Record<string, unknown>>; rejected?: unknown }
    | undefined;

  if (planOutput?.plans?.length) {
    await prisma.plan.createMany({
      data: planOutput.plans.map((p) => ({
        runId,
        name: String(p.name ?? "Plan"),
        useRewards: (p.useRewards ?? []) as object,
        savedUsd: Number(p.savedUsd ?? 0),
        cashUsd: Number(p.cashUsd ?? 0),
        rejected: (planOutput.rejected ?? []) as object,
      })),
    });
  }
}
