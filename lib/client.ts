import {
  RunInputSchema,
  PlanInputSchema,
  WalletResponseSchema,
  type WalletReward,
} from "@/lib/schemas";
import type { PlanCardData, RejectedRewardData } from "@/components/PlanCards";

export type { WalletReward };

/**
 * Typed browser API client. Validates input with the SAME Zod schemas the
 * server enforces (lib/schemas) before sending, and normalizes transport/rate-
 * limit outcomes into typed results the store/UI render. OWNER: Aakash.
 */

export interface AgentResponse {
  status: "done" | "blocked" | "error" | "rate_limited" | "invalid";
  answer?: string;
  error?: string;
  runId?: string;
}

export interface PlanResponse {
  plans?: PlanCardData[];
  rejected?: RejectedRewardData[];
  offerCount?: number;
  needsOffers?: boolean;
  error?: string;
}

async function postJson(url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

export async function requestAgentRun(goal: string): Promise<AgentResponse> {
  const parsed = RunInputSchema.safeParse({ goal });
  if (!parsed.success) {
    return { status: "invalid", error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { status, data } = await postJson("/api/runs", parsed.data);
  if (status === 429) {
    return { status: "rate_limited", error: "Too many requests — give it a moment." };
  }
  return {
    status: (data.status as AgentResponse["status"]) ?? "error",
    answer: data.answer as string | undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    runId: data.runId as string | undefined,
  };
}

export async function requestPlan(category: string, maxPriceUsd?: number): Promise<PlanResponse> {
  const parsed = PlanInputSchema.safeParse({
    category,
    ...(maxPriceUsd ? { maxPriceUsd } : {}),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { status, data } = await postJson("/api/plan", parsed.data);
  if (status === 429) return { error: "Too many requests — give it a moment." };
  return data as PlanResponse;
}

export async function fetchWallet(userId = "demo-user"): Promise<WalletReward[]> {
  const res = await fetch(`/api/wallet?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`wallet fetch failed (${res.status})`);
  // Zod validates the server payload before it reaches the UI.
  return WalletResponseSchema.parse(await res.json()).rewards;
}
