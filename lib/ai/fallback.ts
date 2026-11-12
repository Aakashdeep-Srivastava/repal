import type { LanguageModel } from "ai";

/**
 * Provider fallback chain with rate-limit-aware cooldown + backoff.
 *
 * Wraps an ordered list of language models into a single model that tries each
 * in turn. Errors are classified into three buckets:
 *
 *   - "fatal"         malformed input / 400 / unsupported — a caller bug. Thrown
 *                     immediately, NOT masked, so bugs stay visible.
 *   - "transient"     per-minute rate limit (429), overload, 5xx, timeout,
 *                     network. Retried on the SAME provider with exponential
 *                     backoff (honoring Retry-After) a few times, then the
 *                     provider is put on a SHORT cooldown and we fail over.
 *   - "provider_down" daily token cap, auth/payment/forbidden, quota exhausted.
 *                     No same-provider retry — the provider goes on a LONG
 *                     cooldown and we fail over at once.
 *
 * The cooldown registry is the "proper rate limiting" piece: once a provider
 * signals it's capped (e.g. Bedrock's account-wide "too many tokens per day"),
 * subsequent requests SKIP it entirely for the cooldown window instead of
 * paying a doomed round-trip on every single call. When the window elapses the
 * provider is tried again and auto-promotes if it has recovered.
 *
 * This is what lets RePal run on a free provider today, fail over to a second
 * free provider if the first throttles, and promote AWS Bedrock back to primary
 * the moment its quota clears — all behind the same `claude` handle, no caller
 * changes. See lib/ai/bedrock.ts for how the chain is assembled.
 *
 * State is per-instance (module-level Map). For multi-instance deploys this is
 * best-effort — each instance learns a provider is down on its first failed
 * call — which is exactly the right degradation for a cost/latency guard.
 */

/** Minimal structural view of a LanguageModelV4 — all we proxy. */
type ModelV4 = {
  specificationVersion: "v4";
  provider: string;
  modelId: string;
  supportedUrls: PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;
  doGenerate(options: unknown): Promise<unknown>;
  doStream(options: unknown): Promise<unknown>;
};

export type ErrorClass = "fatal" | "transient" | "provider_down";

// ─── Tunables ─────────────────────────────────────────────────────────
/** A daily cap / auth / payment failure: the provider is out for a long while. */
const PROVIDER_DOWN_COOLDOWN_MS = 30 * 60_000; // 30 min
/** A per-minute throttle / 5xx: comes back quickly. */
const TRANSIENT_COOLDOWN_MS = 30_000; // 30 s
/** Same-provider backoff retries before we cool it and fail over. */
const MAX_TRANSIENT_RETRIES = 2;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 8_000;

// ─── Cooldown registry (per-instance, best-effort) ────────────────────
const cooldownUntil = new Map<string, number>(); // "provider:modelId" → epoch ms

function keyOf(m: ModelV4): string {
  return `${m.provider}:${m.modelId}`;
}

function isCooling(key: string, now: number): boolean {
  const until = cooldownUntil.get(key);
  if (until === undefined) return false;
  if (until <= now) {
    cooldownUntil.delete(key);
    return false;
  }
  return true;
}

/** Test/ops hook: clear all cooldowns. */
export function resetCooldowns(): void {
  cooldownUntil.clear();
}

// ─── Error classification ─────────────────────────────────────────────
function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number };
  return e?.statusCode ?? e?.status;
}

function messageOf(err: unknown): string {
  const e = err as { name?: string; message?: string };
  return `${e?.name ?? ""} ${e?.message ?? ""}`.toLowerCase();
}

/** How a failed call should be handled. */
export function classifyError(err: unknown): ErrorClass {
  const status = statusOf(err);
  const msg = messageOf(err);

  // Auth/credential problems (bad or missing API key, unauthorized) — the
  // PROVIDER is misconfigured, so fail over to the NEXT provider rather than
  // hard-failing the whole chain. MUST precede the generic 400/"invalid" fatal
  // checks below: providers report a bad key as "invalid api key" (often 401),
  // which the "invalid" rule would otherwise misread as a fatal caller bug and
  // stop the chain at the first provider with a wrong key.
  if (
    status === 401 ||
    status === 403 ||
    /x-api-key|api[-_ ]?key|unauthor|forbidden|access denied|not authorized|permission denied|authentication/.test(msg)
  ) {
    return "provider_down";
  }

  // Caller bugs — never masked, never retried, never failed over.
  if (status === 400 || status === 404 || status === 422) return "fatal";
  if (/invalid|validation|malformed|unsupported|bad request|no body|schema/.test(msg) &&
      !/throttl|rate.?limit|quota|too many/.test(msg)) {
    return "fatal";
  }

  // Provider is out for a while: a DAILY cap, or auth/payment/permission.
  if (/per day|daily|tokens per day|quota exceeded|insufficient|balance|payment|credit/.test(msg)) {
    return "provider_down";
  }
  if (status === 401 || status === 402 || status === 403) return "provider_down";
  if (/access denied|not authorized|unauthorized|forbidden/.test(msg)) return "provider_down";

  // Quick-recovery throttles / server hiccups: back off and retry, then fail over.
  if (status === 429) return "transient";
  if (typeof status === "number" && status >= 500) return "transient";
  if (/throttl|rate.?limit|overload|unavailable|timeout|econn|network|fetch failed|too many/.test(msg)) {
    return "transient";
  }

  // Unknown: treat as transient so the chain tries the next provider rather than
  // hard-failing on something we didn't anticipate.
  return "transient";
}

/** True for errors where trying the next provider makes sense (not caller bugs). */
export function isFailoverError(err: unknown): boolean {
  return classifyError(err) !== "fatal";
}

// ─── Backoff helpers ──────────────────────────────────────────────────
function retryAfterMs(err: unknown): number | undefined {
  const e = err as { responseHeaders?: Record<string, string>; headers?: Record<string, string> };
  const h = e?.responseHeaders ?? e?.headers;
  const raw = h?.["retry-after"] ?? h?.["Retry-After"];
  if (!raw) return undefined;
  const secs = Number(raw);
  return Number.isFinite(secs) ? Math.min(secs * 1000, MAX_BACKOFF_MS) : undefined;
}

function backoffMs(attempt: number, err: unknown): number {
  const server = retryAfterMs(err);
  if (server !== undefined) return server;
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return exp + Math.floor(Math.random() * BASE_BACKOFF_MS); // jitter
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wrap an error so the AI SDK won't blindly retry an already-exhausted chain. */
function nonRetryable(err: unknown): Error {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "all providers unavailable";
  const wrapped = new Error(`repal-fallback: all providers exhausted — ${message}`);
  (wrapped as { isRetryable?: boolean }).isRetryable = false;
  (wrapped as { cause?: unknown }).cause = err;
  return wrapped;
}

/**
 * Build a single model that fails over across `models` in order, with cooldown
 * and backoff. Always wraps (even a single model) so classification/cooldown
 * apply uniformly — a daily-capped sole provider fails fast instead of eating
 * the SDK's blind retries.
 */
export function createFallbackModel(
  models: LanguageModel[],
  label = "repal-fallback",
): LanguageModel {
  const chain = models.filter(Boolean) as unknown as ModelV4[];
  if (chain.length === 0) throw new Error("createFallbackModel: no models provided");

  const run = async (method: "doGenerate" | "doStream", options: unknown): Promise<unknown> => {
    const now = Date.now();
    // Prefer providers not on cooldown; if ALL are cooling, try them anyway
    // (better to attempt than to hard-fail while something might have recovered).
    const warm = chain.filter((m) => !isCooling(keyOf(m), now));
    const order = warm.length > 0 ? warm : chain;

    let lastErr: unknown;
    for (const m of order) {
      const key = keyOf(m);
      for (let attempt = 0; ; attempt++) {
        try {
          return await m[method](options);
        } catch (e) {
          lastErr = e;
          const cls = classifyError(e);
          if (cls === "fatal") throw e; // caller bug — surface immediately

          if (cls === "transient" && attempt < MAX_TRANSIENT_RETRIES) {
            await sleep(backoffMs(attempt, e));
            continue; // retry the SAME provider
          }

          // provider_down, or transient retries exhausted → cool it + fail over
          const cooldown = cls === "provider_down" ? PROVIDER_DOWN_COOLDOWN_MS : TRANSIENT_COOLDOWN_MS;
          cooldownUntil.set(key, Date.now() + cooldown);
          break; // next provider
        }
      }
    }
    throw nonRetryable(lastErr);
  };

  const wrapper: ModelV4 = {
    specificationVersion: "v4",
    provider: label,
    modelId: chain[0].modelId,
    supportedUrls: chain[0].supportedUrls,
    doGenerate: (options) => run("doGenerate", options),
    doStream: (options) => run("doStream", options),
  };
  return wrapper as unknown as LanguageModel;
}
