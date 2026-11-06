import { NextResponse } from "next/server";
import { channel3Health } from "@/lib/channel3";

/**
 * GET /api/health/channel3 — provider diagnostics WITHOUT exposing the key.
 *
 * Reports whether Channel3 is configured, the active discovery mode (live/demo),
 * live connectivity (a tiny probe search), locale, latency, and — on failure —
 * the failure kind (unauthorized / rate_limited / …). Safe to expose: it never
 * returns the API key or any secret. HTTP status mirrors reachability so uptime
 * checks can gate on it.
 */
export async function GET() {
  const health = await channel3Health();
  const status = !health.configured ? 503 : health.reachable ? 200 : 502;
  return NextResponse.json(health, { status });
}
