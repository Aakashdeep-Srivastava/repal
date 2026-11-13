import { test, expect } from "@playwright/test";

/**
 * Home (/) is now the marketing Landing (components/landing/Landing.tsx). These
 * tests validate the Landing itself (hero + CTAs), the one-click sign-in, and
 * the surfaces the old "agent shell" moved to:
 *   - the agent goal input now lives in the authed dashboard (/wallet) and routes
 *     a goal into the shop;
 *   - the deterministic optimizer ("cheapest after rewards") is still exercised
 *     directly via POST /api/plan.
 */
test.describe("Home / Landing", () => {
  test("renders the hero and the primary CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/cheapest price/i);
    // The hero CTAs (the SiteFooter repeats them, so scope to the first).
    await expect(page.getByRole("button", { name: "Try Live Demo" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Login with PayPal/i }).first()).toBeVisible();
    // Marketing nav is present (the old "Wallet"/"Agent" links are gone).
    await expect(page.getByRole("link", { name: "How it Works" }).first()).toBeVisible();
  });

  test("the Try Live Demo CTA logs in and reaches the wallet", async ({ page }) => {
    // Judge-login seeds the persona in Neon; allow headroom under parallel load.
    test.setTimeout(120_000);
    await page.goto("/");
    await page.getByRole("button", { name: "Try Live Demo" }).first().click();
    await expect(page).toHaveURL(/\/wallet/, { timeout: 60_000 });
    await expect(page.getByText(/Maya/).first()).toBeVisible();
  });

  test("the relocated agent goal input routes a goal into the shop", async ({ page }) => {
    // The agent shell moved into the authed dashboard.
    await page.request.post("/api/auth/judge-login");
    await page.goto("/wallet");

    const goal = page.getByPlaceholder(/Type a goal/i);
    await expect(goal).toBeVisible();
    await goal.fill("headphones");
    await page.getByRole("button", { name: "Send" }).click();

    // Intent routing sends a product goal to the shop search.
    await expect(page).toHaveURL(/\/shop\?q=headphones/);
  });

  test("the deterministic optimizer returns cheapest-after-rewards plans (or asks to connect Channel3)", async ({
    page,
  }) => {
    const res = await page.request.post("/api/plan", {
      data: { category: "headphones", userId: "judge-maya" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // Either real plans are returned, or the graceful "needs offers" note when
    // Channel3 (and the offer cache) isn't available.
    expect(Array.isArray(body.plans) || body.needsOffers === true).toBeTruthy();
    if (Array.isArray(body.plans) && body.plans.length > 0) {
      expect(body.plans[0].name).toMatch(/Cheapest after rewards/i);
    }
  });
});
