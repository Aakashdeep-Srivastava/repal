import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";

/**
 * AWS Bedrock provider — Claude for RePal's AI agents layer (A0 orchestrator,
 * Terms agent). Claude is served through Amazon Bedrock in the reclevo.in AWS
 * account, via the Vercel AI SDK's Bedrock provider.
 *
 * Auth precedence (resolved by the provider from the environment — never code):
 *   1. AWS_BEARER_TOKEN_BEDROCK          — a Bedrock API key (recommended; simplest)
 *   2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ AWS_SESSION_TOKEN) — least-priv IAM
 *   3. the ambient AWS credential chain  — SSO / instance role, in AWS-hosted envs
 *
 * NEVER hardcode a key. Credentials come from .env / the deploy environment only,
 * both git-ignored. See docs/BEDROCK.md for how to mint the key (least privilege)
 * in the reclevo.in account and enable Claude model access.
 *
 * Prime directive: the LLM NEVER computes money. This provider backs only the
 * read / plan / explain / parse steps; all monetary math stays in the
 * deterministic, unit-tested lib/ core. See docs/TECH_PRD.md §3.
 *
 * OWNER: Aakash (provider + credential provisioning). The AI agents layer owner
 * consumes `claude` inside agents/ tools; this file stays provider-only.
 */

/** AWS region hosting Bedrock — us-west-2, co-located with the Oregon Neon DB. */
export const AWS_REGION = process.env.AWS_REGION ?? "us-west-2";

/**
 * Bedrock Claude model (inference-profile) id — kept in env so the exact id is
 * configuration, not code. reclevo.in / us-west-2 (ACTIVE):
 *   us.anthropic.claude-haiku-4-5-20251001-v1:0   ← our model (available, cheap)
 *   global.anthropic.claude-haiku-4-5-20251001-v1:0   (global routing alternative)
 * Opus 4.8 / Sonnet 5 are "not available for this account" in every region —
 * they need a separate access request (AWS Sales), not a region/quota change.
 * No default on purpose: a wrong id fails silently at call time. The only gate
 * is the one-time Anthropic use-case form (console). See docs/BEDROCK.md.
 */
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID;

function hasCredentials(): boolean {
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  );
}

/**
 * True iff Bedrock is fully configured (credentials + model id). Lets callers
 * cheaply decide whether to attempt an LLM call at all, instead of firing a
 * request they know will fail — e.g. ingestion skips T&C parsing when this is
 * false rather than making one doomed network round-trip per reward.
 */
export function isBedrockConfigured(): boolean {
  return hasCredentials() && Boolean(BEDROCK_MODEL_ID);
}

/**
 * Fail fast with an actionable message if Bedrock isn't configured. Call this
 * at the entry of any flow that uses `claude`, so a missing key surfaces as a
 * clear error instead of a cryptic AWS auth failure deep in a request.
 */
export function assertBedrockConfigured(): void {
  if (!hasCredentials()) {
    throw new Error(
      "AWS Bedrock is not configured. Set AWS_BEARER_TOKEN_BEDROCK (a Bedrock API " +
        "key) OR AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, plus AWS_REGION. " +
        "See docs/BEDROCK.md §Credentials.",
    );
  }
  if (!BEDROCK_MODEL_ID) {
    throw new Error(
      "BEDROCK_MODEL_ID is not set. Copy the Claude model / inference-profile id " +
        "from the Bedrock console (Model access) into .env. See docs/BEDROCK.md.",
    );
  }
}

/** Shared Bedrock provider. Auth + region come from the environment. */
export const bedrock = createAmazonBedrock({ region: AWS_REGION });

/**
 * The Claude model RePal's agents call, served via Bedrock. Constructing the
 * handle does not touch AWS — the first network call happens when a tool runs,
 * at which point `assertBedrockConfigured()` must already have passed.
 */
export const claude = bedrock(BEDROCK_MODEL_ID ?? "bedrock-model-id-not-set");
