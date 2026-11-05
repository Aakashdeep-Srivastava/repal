import { describe, it, expect } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit, then blocks", () => {
    const key = `test-${Math.round(performance.now())}-a`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true); // 1
    expect(rateLimit(key, 3, 60_000).ok).toBe(true); // 2
    const third = rateLimit(key, 3, 60_000); // 3
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = rateLimit(key, 3, 60_000); // 4 → blocked
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const a = `test-${Math.round(performance.now())}-b`;
    const b = `test-${Math.round(performance.now())}-c`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false); // a exhausted
    expect(rateLimit(b, 1, 60_000).ok).toBe(true); // b fresh
  });

  it("resets immediately when the window has already elapsed", () => {
    const key = `test-${Math.round(performance.now())}-d`;
    expect(rateLimit(key, 1, 1).ok).toBe(true); // 1ms window
    // Busy-wait >1ms so the window is guaranteed expired on the next call.
    const start = performance.now();
    while (performance.now() - start < 3) {
      /* spin */
    }
    expect(rateLimit(key, 1, 1).ok).toBe(true); // new window
  });
});
