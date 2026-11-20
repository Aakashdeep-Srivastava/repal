/**
 * In-memory rate limiter — fixed-window counter keyed by client + route.
 *
 * Protects the expensive routes (LLM runs, offer lookups, money ops) from abuse
 * and runaway spend. In-memory means per-instance; for multi-instance deploys
 * swap the Map for Upstash Redis / Vercel KV behind the same `rateLimit()` call
 * (the interface stays identical). OWNER: Aakash.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let lastSweep = 0;

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
  retryAfterSec: number;
}

/** Opportunistically drop expired buckets so the Map can't grow unbounded. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, limit, remaining: limit - 1, resetAt, retryAfterSec: 0 };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Number of *trusted* proxies that append to X-Forwarded-For before the app.
 * In production the chain is Viewer → CloudFront → ALB → app, so the two
 * rightmost XFF entries are written by infrastructure we trust and the real
 * client IP is the one CloudFront recorded (offset 2 from the right). Anything
 * to the LEFT of that is attacker-controlled and must never be trusted.
 * Override with TRUSTED_PROXY_HOPS if the topology changes.
 */
const TRUSTED_PROXY_HOPS = (() => {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  return process.env.NODE_ENV === "production" ? 2 : 0;
})();

/**
 * Resolve the real client IP from X-Forwarded-For WITHOUT trusting the
 * client-supplied (leftmost) entries. We select the entry at a fixed offset
 * from the right — the one written by the nearest trusted proxy — so an
 * attacker spoofing `X-Forwarded-For: <random>` can't mint a fresh bucket per
 * request and sail past the limiter.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      // hops=0 → leftmost (dev/direct); otherwise count from the right.
      const idx = TRUSTED_PROXY_HOPS <= 0 ? 0 : Math.max(0, parts.length - TRUSTED_PROXY_HOPS);
      const ip = parts[Math.min(idx, parts.length - 1)];
      if (ip) return ip;
    }
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

/** Per-client rate-limit key: trusted client IP + route. */
export function clientKey(req: Request, route: string): string {
  return `${route}:${clientIp(req)}`;
}

/** Standard rate-limit response headers (set on every response, ok or not). */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
  if (!r.ok) h["Retry-After"] = String(r.retryAfterSec);
  return h;
}
