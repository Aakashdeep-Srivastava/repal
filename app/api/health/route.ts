import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health — liveness probe for the App Runner health check.
 *
 * Deliberately makes NO external calls by default: it answers 200 as long as
 * the Node process can serve a request. App Runner uses this to decide whether
 * an instance is healthy, so coupling it to Neon/Bedrock/PayPal/Channel3 would
 * let one third-party blip take the whole service down. Provider reachability
 * lives in the dedicated readiness probes (e.g. /api/health/channel3).
 *
 * Opt into a DB round-trip with `?deep=1` for a readiness-style check. Even
 * then the process stays "ok" (liveness); the db field just reports the ping,
 * so a monitor can distinguish "process up" from "database reachable" without
 * the liveness probe flapping.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";

  let db: "ok" | "unreachable" | "skipped" = "skipped";
  if (deep) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "unreachable";
    }
  }

  return NextResponse.json({
    status: "ok",
    service: "repal-web",
    db,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
