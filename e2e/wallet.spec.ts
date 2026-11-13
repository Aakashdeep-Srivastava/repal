import { test, expect } from "@playwright/test";

/**
 * Wallet (live Neon data). Logs in as the judge persona "Maya" first, then loads
 * /wallet and asserts the auto-imported reward wallet renders: the "Reward
 * Wallet" card (a <span>, not an aria heading), the "Auto-imported & AI-parsed"
 * badge, reward cards with $ values, and a recognizable merchant / T&C snippet.
 */
test.describe("Wallet (live Neon data)", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post("/api/auth/judge-login");
  });

  test("loads the auto-imported reward wallet", async ({ page }) => {
    await page.goto("/wallet");

    // The wallet card header ("Reward Wallet" is a span in the dashboard shell).
    await expect(page.getByText("Reward Wallet")).toBeVisible();
    // Provenance badge.
    await expect(page.getByText(/Auto-imported & AI-parsed/i)).toBeVisible();
    // At least one $ value (the hero total and/or a reward card headline).
    await expect(page.getByText(/^\$\d/).first()).toBeVisible();
    // A recognizable seeded merchant / reward-type snippet.
    await expect(
      page
        .getByText(/cashback|gift card|store credit|Best Buy|Target|Nike|Starbucks|coupon/i)
        .first(),
    ).toBeVisible();
  });
});
