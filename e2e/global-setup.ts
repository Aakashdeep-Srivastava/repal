import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, createPrivateKey, sign } from "node:crypto";

/**
 * Seeds a known, validly-signed receipt so the /verify E2E is a real end-to-end
 * check (sign → persist → fetch → verify in the browser). Self-contained (no
 * app imports) so Playwright's loader needs no path-alias resolution; the inline
 * canonical+sign is byte-identical to lib/receipts (sorted-key JSON → SHA-256
 * hex → Ed25519 over the hex → base64), so the running app's verifyReceipt
 * (which uses lib/receipts with the same RECEIPT_SIGNING_KEY) confirms it.
 */
function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

export const E2E_RECEIPT_ID = "e2e-verified-receipt";
export const E2E_RUN_ID = "e2e-run-traced";

/** Canonical JSON for a flat primitive object — matches lib/receipts/canonical. */
function canonicalFlat(obj: Record<string, string | number>): string {
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(obj[k])).join(",") + "}";
}

export default async function globalSetup() {
  loadEnv(".env");
  loadEnv(".env.local");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const input = {
    userId: "demo-user",
    runId: "e2e-run",
    item: "Sony WH-1000XM5",
    merchant: "bestbuy.com",
    category: "headphones",
    priceUsd: 248,
    savedUsd: 40,
    cashUsd: 208,
    paypalOrderId: "E2E-ORDER-1",
    paypalCaptureId: "E2E-CAPTURE-1",
  };

  const sha256 = createHash("sha256").update(canonicalFlat(input), "utf8").digest("hex");
  const key = createPrivateKey({
    key: Buffer.from(process.env.RECEIPT_SIGNING_KEY ?? "", "base64"),
    format: "der",
    type: "pkcs8",
  });
  const signature = sign(null, Buffer.from(sha256, "utf8"), key).toString("base64");

  await prisma.receipt.upsert({
    where: { id: E2E_RECEIPT_ID },
    update: { sha256, signature },
    create: { id: E2E_RECEIPT_ID, ...input, sha256, signature },
  });

  // Seed a completed run with tool traces + a plan for the SSE stream E2E.
  await prisma.agentRun.upsert({
    where: { id: E2E_RUN_ID },
    update: { status: "done", step: "complete" },
    create: { id: E2E_RUN_ID, userId: "demo-user", status: "done", step: "complete" },
  });
  await prisma.toolTrace.deleteMany({ where: { runId: E2E_RUN_ID } });
  await prisma.toolTrace.createMany({
    data: [
      {
        runId: E2E_RUN_ID,
        tool: "render_intent",
        kind: "tool",
        latencyMs: 12,
        payload: { input: { rawText: "headphones under $250" }, output: { category: "headphones", maxPriceUsd: 250 } },
      },
      {
        runId: E2E_RUN_ID,
        tool: "plan_purchase",
        kind: "tool",
        latencyMs: 40,
        payload: { input: { category: "headphones" }, output: { offerCount: 3 } },
      },
    ],
  });
  await prisma.plan.deleteMany({ where: { runId: E2E_RUN_ID } });
  await prisma.plan.create({
    data: { runId: E2E_RUN_ID, name: "Cheapest after rewards", useRewards: [], savedUsd: 40, cashUsd: 208, rejected: [] },
  });

  await prisma.$disconnect();

  // Pre-warm the dev server so the fully-parallel suite doesn't thrash on Next's
  // first-hit, on-demand route/page compilation (which, under concurrent load,
  // can turn a 17s ingest into a multi-minute stall). Best-effort: every call is
  // guarded, so a warm-up miss never fails the run.
  await warmup();
}

/**
 * Hit the pages + API routes the suite exercises once, serially, to force Next
 * dev to compile them before tests fan out. All failures are swallowed.
 */
async function warmup() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const get = async (path: string, init?: RequestInit) => {
    try {
      await fetch(base + path, init).then((r) => r.text().catch(() => ""));
    } catch {
      /* server not up / route errored — ignore, tests will still run */
    }
  };

  // Wait for the dev server to accept connections (it is normally already up via
  // Playwright's webServer, but global setup can race it on a cold boot).
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(base + "/api/pay/mode");
      if (res.ok) break;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  // Light API routes.
  await get("/api/me");
  await get("/api/pay/mode");
  await get("/api/products?q=earbuds");
  await get("/api/wallet?userId=judge-maya");
  await get("/api/auth/judge-login", json({}));

  // Warm the product detail + eligibility + optimizer paths with a real product.
  try {
    const res = await fetch(base + "/api/products?q=earbuds");
    const first = (await res.json())?.products?.[0];
    if (first?.id) {
      await get(`/api/products/${encodeURIComponent(first.id)}`);
      await get(
        "/api/eligibility",
        json({
          product: {
            id: first.id,
            title: first.title,
            priceUsd: first.priceUsd,
            retailer: first.retailer,
            buyUrl: first.buyUrl,
            category: first.category,
          },
        }),
      );
      await get(`/product/${encodeURIComponent(first.id)}`);
    }
  } catch {
    /* ignore */
  }
  await get("/api/plan", json({ category: "earbuds", userId: "judge-maya" }));

  // Warm the (slow, cold-compiling) multi-source ingest route on a throwaway user.
  await get("/api/wallet/ingest", json({ userId: "warmup-e2e-user" }));

  // Warm the pages the browser specs load.
  await get("/");
  await get("/wallet");
  await get("/shop?q=earbuds");
  await get("/checkout");
  await get(`/verify/${E2E_RECEIPT_ID}`);
}
