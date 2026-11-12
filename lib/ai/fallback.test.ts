import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";
import { classifyError, createFallbackModel, isFailoverError, resetCooldowns } from "./fallback";

function mockModel(provider: string, modelId: string, impl: () => Promise<unknown>): LanguageModel {
  return {
    specificationVersion: "v4",
    provider,
    modelId,
    supportedUrls: {},
    doGenerate: impl,
    doStream: impl,
  } as unknown as LanguageModel;
}

// Reach doGenerate on the wrapped model.
function gen(model: LanguageModel): Promise<unknown> {
  return (model as unknown as { doGenerate(o: unknown): Promise<unknown> }).doGenerate({});
}

const daily = () => Promise.reject(Object.assign(new Error("Too many tokens per day"), { statusCode: 429 }));

beforeEach(() => resetCooldowns());

describe("classifyError", () => {
  it("flags caller bugs as fatal", () => {
    expect(classifyError({ statusCode: 400, message: "bad request" })).toBe("fatal");
    expect(classifyError({ message: "invalid model identifier" })).toBe("fatal");
    expect(isFailoverError({ statusCode: 400 })).toBe(false);
  });

  it("flags daily caps / auth / payment as provider_down", () => {
    expect(classifyError({ message: "Too many tokens per day" })).toBe("provider_down");
    expect(classifyError({ statusCode: 402, message: "credit balance too low" })).toBe("provider_down");
    expect(classifyError({ statusCode: 403, message: "forbidden" })).toBe("provider_down");
  });

  it("flags per-minute throttles / 5xx as transient", () => {
    expect(classifyError({ statusCode: 429, message: "rate limit, retry" })).toBe("transient");
    expect(classifyError({ statusCode: 503 })).toBe("transient");
    expect(classifyError({ message: "fetch failed" })).toBe("transient");
  });
});

describe("createFallbackModel", () => {
  it("fails over to the next provider on provider_down", async () => {
    const a = mockModel("bedrock", "claude", daily);
    const b = mockModel("groq", "gpt-oss", () => Promise.resolve("ok-b"));
    const model = createFallbackModel([a, b]);
    await expect(gen(model)).resolves.toBe("ok-b");
  });

  it("skips a cooled-down provider on subsequent calls (no wasted round-trip)", async () => {
    const aImpl = vi.fn(daily);
    const bImpl = vi.fn(() => Promise.resolve("ok-b"));
    const a = mockModel("bedrock", "claude", aImpl);
    const b = mockModel("groq", "gpt-oss", bImpl);
    const model = createFallbackModel([a, b]);

    await gen(model); // first call: tries A (fails, cools it) → B
    await gen(model); // second call: A is cooling → should skip straight to B

    expect(aImpl).toHaveBeenCalledTimes(1); // NOT called again while cooling
    expect(bImpl).toHaveBeenCalledTimes(2);
  });

  it("throws fatal errors immediately without failing over", async () => {
    const bImpl = vi.fn(() => Promise.resolve("ok-b"));
    const a = mockModel("bedrock", "claude", () =>
      Promise.reject(Object.assign(new Error("invalid input"), { statusCode: 400 })),
    );
    const b = mockModel("groq", "gpt-oss", bImpl);
    const model = createFallbackModel([a, b]);

    await expect(gen(model)).rejects.toThrow(/invalid input/);
    expect(bImpl).not.toHaveBeenCalled();
  });

  it("throws a non-retryable error when every provider is exhausted", async () => {
    const a = mockModel("bedrock", "claude", daily);
    const model = createFallbackModel([a]);
    await expect(gen(model)).rejects.toThrow(/all providers exhausted/);
  });
});
