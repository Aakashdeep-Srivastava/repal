import type { LanguageModel } from "ai";

/**
 * Provider fallback chain. Wraps an ordered list of language models into a
 * single model that tries each in turn: if the primary fails with a transient /
 * availability error (throttle, rate limit, quota, auth, payment, 5xx), it fails
 * over to the next. Real request errors (malformed input, 400) are NOT masked —
 * they throw immediately so bugs stay visible.
 *
 * This is what lets RePal run on a free provider today, fall over to a second
 * free provider if the first throttles, and promote AWS Bedrock back to primary
 * the moment its quota clears — all behind the same `claude` handle, no caller
 * changes. See lib/ai/bedrock.ts for how the chain is assembled.
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

/** True for errors where trying the next provider makes sense (not caller bugs). */
export function isFailoverError(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; name?: string; message?: string };
  const status = e?.statusCode ?? e?.status;
  if (status === 429 || status === 401 || status === 402 || status === 403) return true;
  if (typeof status === "number" && status >= 500) return true;
  const msg = `${e?.name ?? ""} ${e?.message ?? ""}`.toLowerCase();
  return /throttl|rate.?limit|quota|overload|unavailable|timeout|payment|access denied|not authorized|insufficient|econn|network|fetch failed|too many/.test(
    msg,
  );
}

/**
 * Build a single model that fails over across `models` in order. Returns the
 * sole model unchanged when there is only one.
 */
export function createFallbackModel(
  models: LanguageModel[],
  label = "repal-fallback",
): LanguageModel {
  const chain = models.filter(Boolean) as unknown as ModelV4[];
  if (chain.length === 0) throw new Error("createFallbackModel: no models provided");
  if (chain.length === 1) return models[0];

  const run = async (method: "doGenerate" | "doStream", options: unknown): Promise<unknown> => {
    let lastErr: unknown;
    for (const m of chain) {
      try {
        return await m[method](options);
      } catch (e) {
        lastErr = e;
        if (!isFailoverError(e)) throw e;
        // else: transient/availability error → try the next provider
      }
    }
    throw lastErr;
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
