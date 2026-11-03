/**
 * PayPal sandbox smoke test.
 *
 *   npm run paypal:smoke
 *
 * Proves you're actually connected to the sandbox:
 *   1. loads .env.local
 *   2. fetches an OAuth access token (validates CLIENT_ID / SECRET)
 *   3. creates a $1.00 Orders v2 order (validates the Orders API + base URL)
 *
 * It does NOT capture — capture needs buyer approval or a Vault token, which
 * come later in the flow. A printed order id + "CREATED" = you're connected.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── minimal .env.local loader (no dependency) ─────────────────────────
function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return; // file optional; env may already be set by the shell
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv(".env"); // shared config
loadEnv(".env.local"); // personal overrides (loaded after, but loader keeps first-set)

async function main() {
  const { getAccessToken, PAYPAL_BASE } = await import("../lib/paypal/client");
  const { createOrder } = await import("../lib/paypal/orders");

  console.log(`→ Base URL: ${PAYPAL_BASE}`);
  console.log(`→ Client ID: ${mask(process.env.PAYPAL_CLIENT_ID)}`);

  console.log("\n[1/2] Fetching OAuth access token…");
  const token = await getAccessToken();
  console.log(`      ✓ token acquired: ${mask(token)}`);

  console.log("\n[2/2] Creating a $1.00 sandbox order…");
  const order = await createOrder({ amountUsd: 1, description: "RePal smoke test" });
  console.log(`      ✓ order ${order.id} — status ${order.status}`);

  console.log("\n✅ Connected to PayPal sandbox.");
}

function mask(v?: string): string {
  if (!v) return "(missing)";
  return v.length <= 8 ? "****" : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:\n", err instanceof Error ? err.message : err);
  console.error(
    "\nFix: copy .env.example → .env.local and fill PAYPAL_CLIENT_ID / " +
      "PAYPAL_CLIENT_SECRET from your sandbox app (see docs/PAYPAL_SETUP.md).",
  );
  process.exit(1);
});
