import {
  RunInputSchema,
  PlanInputSchema,
  WalletResponseSchema,
  type WalletReward,
} from "@/lib/schemas";
import type { PlanCardData, RejectedRewardData } from "@/components/PlanCards";

export type { WalletReward };

/** Current session user shape — mirrors lib/auth/session `SessionUser`. */
export interface SessionUser {
  userId: string;
  name?: string;
  email?: string;
}

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

// ─── Auth / session ───────────────────────────────────────────────────

/** GET /api/me — the current session user, or null if logged out. */
export async function fetchMe(): Promise<SessionUser | null> {
  const res = await fetch("/api/me");
  if (!res.ok) throw new Error(`me fetch failed (${res.status})`);
  const data = (await res.json()) as { user: SessionUser | null };
  return data.user;
}

/** POST /api/auth/demo-login — start a demo session for `demo-user`. */
export async function demoLogin(): Promise<void> {
  const { status } = await postJson("/api/auth/demo-login", {});
  if (status !== 200) throw new Error(`demo login failed (${status})`);
}

/**
 * POST /api/auth/judge-login — one-click judge sign-in. Seeds the self-contained
 * "Maya" persona (signed mandate + labelled sample wallet) and starts a session.
 */
export async function judgeLogin(): Promise<void> {
  const { status } = await postJson("/api/auth/judge-login", {});
  if (status !== 200) throw new Error(`judge login failed (${status})`);
}

/** POST /api/auth/judge-reset — reset the judge persona to a fresh state. */
export async function judgeReset(): Promise<void> {
  const { status } = await postJson("/api/auth/judge-reset", {});
  if (status !== 200) throw new Error(`judge reset failed (${status})`);
}

/** POST /api/auth/logout — clear the current session. */
export async function logout(): Promise<void> {
  const { status } = await postJson("/api/auth/logout", {});
  if (status !== 200) throw new Error(`logout failed (${status})`);
}

// ─── Gmail connection (consent-first ingestion) ───────────────────────

export interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

/** GET /api/connect/gmail — whether Gmail ingestion is available + connected. */
export async function fetchGmailStatus(): Promise<GmailStatus> {
  const res = await fetch("/api/connect/gmail");
  if (!res.ok) throw new Error(`gmail status failed (${res.status})`);
  return (await res.json()) as GmailStatus;
}

/** DELETE /api/connect/gmail — disconnect the current user's Gmail. */
export async function disconnectGmail(): Promise<void> {
  const res = await fetch("/api/connect/gmail", { method: "DELETE" });
  if (!res.ok) throw new Error(`disconnect failed (${res.status})`);
}

// ─── Wallet ingestion (connect sources) ───────────────────────────────

/** Per-source + aggregate counts returned by POST /api/wallet/ingest. */
export interface IngestSummary {
  userId: string;
  bySource: Record<string, { added: number; updated: number }>;
  totalAdded: number;
  totalUpdated: number;
  parsed: number;
  unparsed: number;
}

/**
 * POST /api/wallet/ingest — collect rewards from every connected source into
 * the current user's wallet. `userId` is optional; the server falls back to the
 * session user. Returns the ingestion summary.
 */
export async function ingestWallet(userId?: string): Promise<IngestSummary> {
  const { status, data } = await postJson(
    "/api/wallet/ingest",
    userId ? { userId } : {},
  );
  if (status !== 200) throw new Error(`ingest failed (${status})`);
  return data as unknown as IngestSummary;
}

// ─── Spending mandate (delegated authority) ───────────────────────────

export interface ActiveMandate {
  id: string;
  capUsd: number;
  budgetUsd: number;
  approvalThresholdUsd: number;
  allowCategories: string[];
  allowMerchants: string[];
  expiresAt: string;
  paypalVaultTokenId?: string | null;
  status: string;
}

export interface MandateInput {
  capUsd: number;
  budgetUsd: number;
  approvalThresholdUsd: number;
  allowCategories: string[];
  allowMerchants: string[];
  expiresAt: string; // ISO
}

/** GET /api/mandates — the session user's active mandate, or null. */
export async function fetchMandate(): Promise<ActiveMandate | null> {
  const res = await fetch("/api/mandates");
  if (!res.ok) throw new Error(`mandate fetch failed (${res.status})`);
  const data = (await res.json()) as { mandate: ActiveMandate | null };
  return data.mandate;
}

/**
 * POST /api/mandates — create a Vault-backed mandate. If PayPal returns an
 * `approveUrl`, the caller should redirect the buyer there to approve the Vault
 * token; otherwise the mandate was activated as a signed policy-only mandate.
 */
export async function createMandate(
  input: MandateInput,
): Promise<{ mandateId: string; approveUrl?: string; vault?: string }> {
  const { status, data } = await postJson("/api/mandates", input);
  if (status === 429) throw new Error("Too many requests — give it a moment.");
  if (status !== 201) {
    throw new Error(
      typeof data.error === "string" ? data.error : `mandate create failed (${status})`,
    );
  }
  return {
    mandateId: data.mandateId as string,
    approveUrl: data.approveUrl as string | undefined,
    vault: data.vault as string | undefined,
  };
}

/** DELETE /api/mandates?id= — revoke a mandate. */
export async function revokeMandate(id: string): Promise<void> {
  const res = await fetch(`/api/mandates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`revoke failed (${res.status})`);
}

// ─── Payout (reward → cash liberation) ────────────────────────────────

export interface PayoutResult {
  payoutBatchId: string;
  amountUsd: number;
  receiptId: string;
  verifyUrl: string;
  status?: string;
}

/**
 * POST /api/pay/payout — liberate a reward to the user's PayPal balance. The
 * server bounds the amount to the reward's value and marks it liberated.
 */
export async function payoutReward(input: {
  rewardId: string;
  receiverEmail: string;
  amountUsd: number;
}): Promise<PayoutResult> {
  const { status, data } = await postJson("/api/pay/payout", input);
  if (status === 429) throw new Error("Too many requests — give it a moment.");
  if (status !== 200) {
    throw new Error(typeof data.error === "string" ? data.error : `payout failed (${status})`);
  }
  return data as unknown as PayoutResult;
}

// ─── Insights ─────────────────────────────────────────────────────────

export interface InsightsData {
  kpis: {
    totalSpent: number;
    totalSaved: number;
    totalLiberated: number;
    totalRefunded: number;
    purchases: number;
    payouts: number;
    refunds: number;
    runs: number;
    activeMandate: number;
  };
  series: { date: string; spent: number; saved: number }[];
  recent: {
    id: string;
    item: string;
    merchant: string;
    category: string;
    cashUsd: number;
    savedUsd: number;
    createdAt: string;
    verifyUrl: string;
  }[];
}

/** GET /api/insights — spend/savings dashboard data for the session user. */
export async function fetchInsights(): Promise<InsightsData> {
  const res = await fetch("/api/insights");
  if (!res.ok) throw new Error(`insights fetch failed (${res.status})`);
  return (await res.json()) as InsightsData;
}
