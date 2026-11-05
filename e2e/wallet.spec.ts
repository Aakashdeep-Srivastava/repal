import { test, expect } from "@playwright/test";

test.describe("Wallet (live Neon data)", () => {
  test("loads the auto-imported reward wallet", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: /Reward wallet/i })).toBeVisible();
    // The real seeded wallet (17 rewards from Neon) renders a count + cards.
    await expect(page.getByText(/rewards, auto-imported/i)).toBeVisible();
    // At least one reward card with a $ value.
    await expect(page.getByText(/^\$\d/).first()).toBeVisible();
    // A recognizable seeded T&C snippet.
    await expect(
      page.getByText(/cashback|gift card|gift certificate|Best Buy|Amazon|coupon/i).first(),
    ).toBeVisible();
  });
});
