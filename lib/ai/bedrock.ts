import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createFallbackModel } from "@/lib/ai/fallback";

/**
 * Shared AI model handle for RePal's agent layer — a provider FALLBACK CHAIN.
 *
 * Providers are tried in priority order (AI_PROVIDER_ORDER, default below);
 * every one that is configured joins the chain, and a transient failure on one
 * (throttle, quota, auth, payment, 5xx) fails over to the next. So RePal can run
 * on a free provider today, fall over to a second free provider if the first
 * throttles, and promote AWS Bedrock to primary the moment its quota clears —
 * all behind the same `claude` handle, no caller changes.
 *
 * Supported providers (set the matching key to enable):
 *   bedrock   — AWS creds (env/role/bearer) + BEDROCK_MODEL_ID
 *   groq      — GROQ_API_KEY            (free, fast; OpenAI-compatible)   model: GROQ_MODEL
 *   gemini    — GEMINI_API_KEY          (free; OpenAI-compatible)         model: GEMINI_MODEL
 *   anthropic — ANTHROPIC_API_KEY                                         model: ANTHROPIC_MODEL
 *   openai    — OPENAI_API_KEY                                            model: OPENAI_MODEL
 *
 * Legacy AI_PROVIDER still works: if set, that provider is made PRIMARY and the
 * rest follow as fallbacks. Prime directive unchanged: the LLM NEVER computes
 * money; callers run at temperature 0.
 */

export const AWS_REGION = process.env.AWS_REGION ?? "us-west-2";
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID;
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
// OpenRouter: OpenAI-compatible gateway (openrouter.ai). Model id includes the
// vendor prefix, e.g. "meta-llama/llama-3.3-70b-instruct:free".
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

/** Legacy single-provider env (optional); becomes the primary when set. */
export const AI_PROVIDER = (process.env.AI_PROVIDER ?? "").toLowerCase();

const DEFAULT_ORDER = ["bedrock", "groq", "anthropic", "openai", "gemini", "openrouter"];

function providerOrder(): string[] {
  if (process.env.AI_PROVIDER_ORDER) {
    return process.env.AI_PROVIDER_ORDER.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  if (AI_PROVIDER) return [AI_PROVIDER, ...DEFAULT_ORDER.filter((p) => p !== AI_PROVIDER)];
  return DEFAULT_ORDER;
}

function hasBedrockCredentials(): boolean {
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
      process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
  );
}

/** Is a given provider fully configured to make a call? */
function providerConfigured(p: string): boolean {
  switch (p) {
    case "bedrock": return hasBedrockCredentials() && Boolean(BEDROCK_MODEL_ID);
    case "groq": return Boolean(process.env.GROQ_API_KEY);
    case "gemini": return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    case "anthropic": return Boolean(process.env.ANTHROPIC_API_KEY);
    case "openai": return Boolean(process.env.OPENAI_API_KEY);
    case "openrouter": return Boolean(process.env.OPENROUTER_API_KEY);
    default: return false;
  }
}

/** Build the model handle for a single provider (no network I/O). */
function buildProvider(p: string): LanguageModel {
  switch (p) {
    case "groq": {
      const groq = createOpenAI({
        name: "groq",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      });
      // .chat() forces /chat/completions. The SDK's default openai(model) hits
      // the newer /responses endpoint, which these OpenAI-compatible gateways
      // (Groq, Gemini) don't implement → 404. See docs/BEDROCK.md.
      return groq.chat(GROQ_MODEL);
    }
    case "gemini": {
      const gemini = createOpenAI({
        name: "gemini",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      // Gemini's OpenAI-compat layer only serves /chat/completions, not /responses.
      return gemini.chat(GEMINI_MODEL);
    }
    case "openrouter": {
      const openrouter = createOpenAI({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      // .chat() forces /chat/completions (OpenRouter doesn't serve /responses).
      return openrouter.chat(OPENROUTER_MODEL);
    }
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(ANTHROPIC_MODEL);
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(OPENAI_MODEL);
    case "bedrock":
    default:
      return createAmazonBedrock({
        region: AWS_REGION,
        ...(process.env.AWS_BEARER_TOKEN_BEDROCK ? {} : { credentialProvider: fromNodeProviderChain() }),
      })(BEDROCK_MODEL_ID ?? "bedrock-model-id-not-set");
  }
}

/** The ordered list of providers that are actually configured right now. */
export function configuredProviders(): string[] {
  return providerOrder().filter(providerConfigured);
}

/** True iff at least one provider in the chain is configured. */
export function isAiConfigured(): boolean {
  return configuredProviders().length > 0;
}

export function assertAiConfigured(): void {
  if (isAiConfigured()) return;
  throw new Error(
    "No AI provider configured. Set one of: AWS Bedrock creds + BEDROCK_MODEL_ID, " +
      "GROQ_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or " +
      "OPENROUTER_API_KEY. See docs/BEDROCK.md.",
  );
}

// Back-compat aliases (existing callers import the *Bedrock* names).
export const isBedrockConfigured = isAiConfigured;
export const assertBedrockConfigured = assertAiConfigured;

/** Build the fallback chain over configured providers (constructing does no I/O). */
function buildModel(): LanguageModel {
  const providers = configuredProviders();
  if (providers.length === 0) {
    // Nothing configured — return a Bedrock handle so imports still resolve;
    // assertAiConfigured() is the gate callers use before invoking.
    return buildProvider("bedrock");
  }
  return createFallbackModel(providers.map(buildProvider), `repal:${providers.join(">")}`);
}

/**
 * The model RePal's agents call. Named `claude` for history; it is the provider
 * fallback chain. Constructing it does not touch the network.
 */
export const claude: LanguageModel = buildModel();
