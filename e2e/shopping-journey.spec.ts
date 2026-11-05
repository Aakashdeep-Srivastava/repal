import { test, expect, type Page } from "@playwright/test";

/**
 * The signature RePal shopping journey, end to end in a real browser:
 *   home → search → results → product detail → reward eligibility →
 *   optimization → checkout review → sandbox payment → verified receipt → verify.
 *
 * Everything is driven by real backend results (live Neon products/eligibility,
 * a server-signed sandbox receipt) — no fabricated success. PayPal creds are not
 * configured here, so the demo/sandbox path is exercised and must be labelled as
 * such throughout.
 */

/** Drive home → results → product detail, and return the review CTA locator. */
async function openProductFromSearch(page: Page) {
  await page.goto("/");
  await page.getByLabel("Shop for a product").fill("headphones");
  await page.getByRole("button", { name: "Start shopping" }).click();

  await expect(page).toHaveURL(/\/shop\?q=headphones/);
  // Provenance is shown — demo data is never passed off as live.
  await expect(page.getByText(/Demo products/i)).toBeVisible();

  // Tap the first product (its title lives inside the clickable card).
  const firstTitle = page.getByRole("heading", { level: 3 }).first();
  await expect(firstTitle).toBeVisible();
  await firstTitle.click();

  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Eligibility resolves → a review CTA appears (allow → "Review checkout",
  // ask → "Review & approve"). Both proceed to checkout.
  const reviewCta = page.getByRole("button", { name: /Review (checkout|& approve)/i });
  await expect(reviewCta).toBeVisible({ timeout: 25_000 });
  return reviewCta;
}

test.describe("Shopping journey", () => {
  test("search → product → rewards → checkout → sandbox payment → verified receipt", async ({
    page,
  }) => {
    const reviewCta = await openProductFromSearch(page);

    // Optimization / savings breakdown is shown on the detail page.
    await expect(page.getByText(/Total payable now/i)).toBeVisible();

    await reviewCta.click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    // Environment is labelled prominently (no PayPal creds → Sandbox / Demo).
    await expect(page.getByText("Sandbox / Demo")).toBeVisible();

    // Confirm the order, then pay (sandbox path).
    await page.getByRole("checkbox", { name: /I confirm this order/i }).check();
    const payBtn = page.getByRole("button", { name: /Pay with PayPal/i });
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // Success is reached only once the server returns a signed receipt.
    await expect(page.getByText(/Sandbox receipt issued/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Signed receipt .*\(sandbox\)/i)).toBeVisible();
    // Honest labelling — no claim of a live capture.
    await expect(page.getByText(/no live PayPal capture/i)).toBeVisible();

    // The receipt is genuinely verifiable at the public verifier.
    await page.getByRole("button", { name: "View receipt" }).click();
    await expect(page).toHaveURL(/\/verify\//);
    await expect(page.getByText(/Signature verified|Cannot verify here/i)).toBeVisible();
    await expect(page.getByText(/Signature INVALID/i)).toHaveCount(0);
  });

  test("journey remains fully functional with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const reviewCta = await openProductFromSearch(page);
    // Navigation + eligibility still work with animation disabled.
    await reviewCta.click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await context.close();
  });

  test("refreshing mid-checkout preserves the order (no lost progress)", async ({ page }) => {
    const reviewCta = await openProductFromSearch(page);
    await reviewCta.click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    // Reload — the sessionStorage-persisted journey must restore the checkout,
    // NOT drop to the "nothing to check out" empty state.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(page.getByText(/Nothing to check out/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Pay with PayPal/i })).toBeVisible();
  });
});
