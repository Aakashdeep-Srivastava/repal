import { test, expect } from "@playwright/test";

/**
 * Capstone journey — the whole target slice in one real browser flow:
 *   authenticate → collect rewards from multiple sources → see them stored in
 *   the wallet → log out.
 *
 * This complements the focused specs rather than repeating them:
 *   - auth.spec.ts  proves the login/logout session cycle (API + nav).
 *   - ingest.spec.ts proves multi-source collection + idempotency (API level).
 * Here we prove they are wired together through the actual UI: a logged-in user
 * clicks "Sync rewards" and sees rewards from several sources land in the wallet.
 */

// Collection hits live Neon across 5 source adapters, so allow generous headroom.
test.setTimeout(90_000);

test.describe("Journey: auth → collect → wallet", () => {
  test("log in, sync rewards from multiple sources, see them stored, log out", async ({
    page,
  }) => {
    // 1. Start logged out; demo-login from the home nav.
    await page.goto("/");
    await page.getByRole("button", { name: "Demo login" }).click();
    await expect(page.getByText("Demo User")).toBeVisible();

    // 2. Open the wallet — it resolves to the logged-in user.
    await page.getByRole("link", { name: "Wallet" }).click();
    await expect(page.getByRole("heading", { name: /Reward wallet/i })).toBeVisible();
    await expect(page.getByText(/Showing:\s*Demo User/i)).toBeVisible();

    // 3. Collect rewards from every connected source.
    const syncBtn = page.getByRole("button", { name: "Sync rewards" });
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // The success banner reports how many sources were collected from.
    await expect(page.getByText(/Collected from \d+ sources/i)).toBeVisible({
      timeout: 60_000,
    });

    // 4. The wallet shows rewards stored from multiple distinct sources.
    for (const src of ["gmail", "paypal", "card"]) {
      await expect(page.getByText(src, { exact: true }).first()).toBeVisible();
    }

    // 5. Log out (the auth controls live in the home nav) → back to logged-out.
    await page.getByRole("link", { name: "Agent" }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("button", { name: "Demo login" })).toBeVisible();
  });
});
