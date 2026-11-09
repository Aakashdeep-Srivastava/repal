import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Shared AI model handle for RePal's agent layer — provider-switchable.
 *
 *   AI_PROVIDER = bedrock (default) | anthropic | openai
 *
 * Bedrock (via the reclevo.in account) is the intended main provider, but it is
 * gated behind the one-time Anthropic use-case form. Until that clears, set
 * AI_PROVIDER=anthropic with an ANTHROPIC_API_KEY so live agent runs work now.
 * The exported names are kept (`claude`, `isBedrockConfigured`,
 * `assertBedrockConfigured`) so callers don't change; `isAiConfigured` /
 * `assertAiConfigured` are clearer aliases.
 *
 * Prime directive: the LLM NEVER computes money. This handle backs only the
 * read / plan / explain / parse steps. Callers run at temperature 0.
 */
export const AI_PROVIDER = (process.env.AI_PROVIDER ?? "bedrock").toLowerCase();

export const AWS_REGION = process.env.AWS_REGION ?? "us-west-2";
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID;
/** Direct-Anthropic model id (override via env). */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function hasBedrockCredentials(): boolean {
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      // Ambient container/instance role (ECS Fargate / App Runner) — no env keys.
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
      process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
  );
}

/** True iff the SELECTED provider is fully configured to make a call. */
export function isAiConfigured(): boolean {
  if (AI_PROVIDER === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (AI_PROVIDER === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return hasBedrockCredentials() && Boolean(BEDROCK_MODEL_ID);
}

/** Fail fast with an actionable, provider-specific message. */
export function assertAiConfigured(): void {
  if (isAiConfigured()) return;
  if (AI_PROVIDER === "anthropic") {
    throw new Error("AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
  }
  if (AI_PROVIDER === "openai") {
    throw new Error("AI_PROVIDER=openai but OPENAI_API_KEY is not set.");
  }
  throw new Error(
    "AWS Bedrock is not configured. Set AWS creds (key / bearer / role) + " +
      "BEDROCK_MODEL_ID, or switch AI_PROVIDER=anthropic with an ANTHROPIC_API_KEY. " +
      "See docs/BEDROCK.md.",
  );
}

// Back-compat aliases (existing callers import the *Bedrock* names).
export const isBedrockConfigured = isAiConfigured;
export const assertBedrockConfigured = assertAiConfigured;

/** Build the shared model handle for the selected provider (no network I/O). */
function buildModel(): LanguageModel {
  if (AI_PROVIDER === "anthropic") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return anthropic(ANTHROPIC_MODEL);
  }
  if (AI_PROVIDER === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai(OPENAI_MODEL);
  }
  const bedrock = createAmazonBedrock({
    region: AWS_REGION,
    ...(process.env.AWS_BEARER_TOKEN_BEDROCK
      ? {}
      : { credentialProvider: fromNodeProviderChain() }),
  });
  return bedrock(BEDROCK_MODEL_ID ?? "bedrock-model-id-not-set");
}

/**
 * The model RePal's agents call. Named `claude` for history; it is whatever
 * AI_PROVIDER selects. Constructing it does not touch the network.
 */
export const claude: LanguageModel = buildModel();
