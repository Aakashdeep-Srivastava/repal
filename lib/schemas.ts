import { z } from "zod";

/**
 * Shared request schemas — the single source of truth for API input validation,
 * imported by both the route handlers (server) and the UI (client) so the same
 * bounds are enforced on both sides. Bounds double as a cheap DoS guard (max
 * lengths / value ceilings). OWNER: Aakash.
 */

export const RunInputSchema = z.object({
  userId: z.string().min(1).max(64).default("demo-user"),
  goal: z.string().trim().min(1, "Tell RePal what to buy").max(500),
});
export type RunInput = z.infer<typeof RunInputSchema>;

export const PlanInputSchema = z.object({
  userId: z.string().min(1).max(64).default("demo-user"),
  category: z.string().trim().min(1, "Enter a category").max(100),
  maxPriceUsd: z.number().positive().max(1_000_000).optional(),
});
export type PlanInput = z.infer<typeof PlanInputSchema>;

export const MandateInputSchema = z.object({
  userId: z.string().min(1).max(64).default("demo-user"),
  capUsd: z.number().positive().max(1_000_000),
  budgetUsd: z.number().positive().max(1_000_000),
  approvalThresholdUsd: z.number().positive().max(1_000_000),
  allowCategories: z.array(z.string().max(100)).max(50).default([]),
  allowMerchants: z.array(z.string().max(100)).max(50).default([]),
  expiresAt: z.string().datetime(),
});
export type MandateInput = z.infer<typeof MandateInputSchema>;

export const WalletImportInputSchema = z.object({
  userId: z.string().min(1).max(64).default("demo-user"),
});
export type WalletImportInput = z.infer<typeof WalletImportInputSchema>;

// ─── Response schemas (validate what the server returns, client-side) ─────
export const WalletRewardSchema = z.object({
  id: z.string(),
  source: z.string(),
  type: z.string(),
  valueUsd: z.number(),
  termsRaw: z.string(),
  status: z.string(),
  parseConfidence: z.number(),
  expiresAt: z.string(),
});
export type WalletReward = z.infer<typeof WalletRewardSchema>;

export const WalletResponseSchema = z.object({
  userId: z.string(),
  count: z.number(),
  rewards: z.array(WalletRewardSchema),
});
