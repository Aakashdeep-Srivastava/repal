import { test, expect } from "@playwright/test";

/**
 * Multi-source reward ingestion E2E.
 *
 * Exercises POST /api/wallet/ingest end-to-end against live Neon: collect from
 * multiple sources, verify the wallet spans ≥3 distinct sources, and prove the
 * ingestion is idempotent (a second run adds nothing). Isolated to a dedicated
 * test user so it never touches the seeded demo-user wallet.
 */

const TEST_USER = "ingest-e2e-user";

async function walletCount(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(`/api/wallet?userId=${TEST_USER}`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { count: body.count as number, rewards: body.rewards as { source: string }[] };
}

test.describe("Reward ingestion (multi-source, idempotent)", () => {
  test("collects rewards from ≥3 sources and is idempotent on re-run", async ({
    request,
  }) => {
    // First ingestion.
    const first = await request.post("/api/wallet/ingest", {
      data: { userId: TEST_USER },
    });
    expect(first.ok()).toBeTruthy();
    const firstSummary = await first.json();

    expect(firstSummary.userId).toBe(TEST_USER);
    expect(firstSummary.totalAdded + firstSummary.totalUpdated).toBeGreaterThan(0);
    // Rewards collected from at least 3 distinct sources.
    expect(Object.keys(firstSummary.bySource).length).toBeGreaterThanOrEqual(3);

    // Wallet now spans ≥3 distinct source values.
    const after1 = await walletCount(request);
    const sources = new Set(after1.rewards.map((r) => r.source));
    expect(sources.size).toBeGreaterThanOrEqual(3);
    expect(sources.has("gmail")).toBeTruthy();
    expect(sources.has("paypal")).toBeTruthy();
    expect(sources.has("card")).toBeTruthy();

    // Second (idempotent) ingestion — count must not grow.
    const second = await request.post("/api/wallet/ingest", {
      data: { userId: TEST_USER },
    });
    expect(second.ok()).toBeTruthy();
    const secondSummary = await second.json();

    expect(secondSummary.totalAdded).toBe(0);
    expect(secondSummary.totalUpdated).toBeGreaterThan(0);

    const after2 = await walletCount(request);
    expect(after2.count).toBe(after1.count);
  });
});
