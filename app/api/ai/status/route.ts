import { NextResponse } from "next/server";
import { configuredProviders, isAiConfigured } from "@/lib/ai/bedrock";
import { getAiActivity } from "@/lib/ai/fallback";

/**
 * GET /api/ai/status — which AI providers are wired, and which one last served a
 * call (plus whether it had to fail over). Lets the UI honestly show "running on
 * Groq" / "switched to Groq" during an agent run. Best-effort + per-instance.
 */
export const dynamic = "force-dynamic";

const FRIENDLY: Record<string, string> = {
  groq: "Groq",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  bedrock: "Bedrock",
  anthropic: "Anthropic",
  openai: "OpenAI",
};

export async function GET() {
  const providers = configuredProviders().map((p) => FRIENDLY[p] ?? p);
  return NextResponse.json({
    configured: isAiConfigured(),
    providers, // configured, in fallback priority order
    primary: providers[0] ?? null,
    active: getAiActivity(), // { provider, switchedFrom?, at } | null
  });
}
