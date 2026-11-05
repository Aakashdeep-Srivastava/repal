/**
 * AWS Bedrock smoke test.
 *
 *   npm run bedrock:smoke
 *
 * Proves you're actually connected to Claude via Bedrock in the reclevo.in
 * account:
 *   1. loads .env then .env.local
 *   2. checks credentials + model id are present
 *   3. runs one tiny generateText call (validates auth, region, model access)
 *
 * A printed "RePal Bedrock OK" + token usage = you're connected.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── minimal env loader (no dependency): .env (shared) then .env.local ──
function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return; // optional; env may already be set by the shell
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadEnv(".env");
loadEnv(".env.local");

function mask(v?: string): string {
  if (!v) return "(missing)";
  return v.length <= 8 ? "****" : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

async function main() {
  // Dynamic import AFTER env load so the provider reads the right values.
  const { generateText } = await import("ai");
  const { claude, BEDROCK_MODEL_ID, AWS_REGION, assertBedrockConfigured } =
    await import("../lib/ai/bedrock");

  const authMode = process.env.AWS_BEARER_TOKEN_BEDROCK
    ? `Bedrock API key (${mask(process.env.AWS_BEARER_TOKEN_BEDROCK)})`
    : `IAM access key (${mask(process.env.AWS_ACCESS_KEY_ID)})`;
  console.log(`→ Region:   ${AWS_REGION}`);
  console.log(`→ Model:    ${BEDROCK_MODEL_ID ?? "(missing)"}`);
  console.log(`→ Auth:     ${authMode}`);

  assertBedrockConfigured();

  console.log("\n[1/1] Calling Claude via Bedrock…");
  const { text, usage } = await generateText({
    model: claude,
    prompt: 'Reply with exactly this and nothing else: "RePal Bedrock OK"',
  });
  console.log(`      ✓ response: ${text.trim()}`);
  console.log(`      ✓ usage:    ${JSON.stringify(usage)}`);

  console.log("\n✅ Connected to Claude via AWS Bedrock.");
}

main().catch((err) => {
  console.error("\n❌ Bedrock smoke test failed:\n", err instanceof Error ? err.message : err);
  console.error(
    "\nFix: set AWS_BEARER_TOKEN_BEDROCK (or AWS_ACCESS_KEY_ID + " +
      "AWS_SECRET_ACCESS_KEY), AWS_REGION, and BEDROCK_MODEL_ID in .env. " +
      "See docs/BEDROCK.md.",
  );
  process.exit(1);
});
