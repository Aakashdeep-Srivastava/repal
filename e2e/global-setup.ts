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
  await prisma.$disconnect();
}
