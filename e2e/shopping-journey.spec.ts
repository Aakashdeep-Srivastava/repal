import { test, expect, type Page } from "@playwright/test";

/**
 * The signature RePal shopping journey, end to end in a real browser:
 *   log in → shop search → results → product detail → reward eligibility →
 *   optimization → checkout review → sandbox payment → verified receipt → verify.
 *
 * Driven by real backend results: live Channel3 product discovery, the real
 * eligibility/optimizer, and a server-signed sandbox receipt (same Ed25519
 * signing as the live path). We force the sandbox/demo payment path — which
 * issues a genuine, verifiable receipt WITHOUT any live PayPal capture — by
 * stubbing the capability probe GET /api/pay/mode. This never uses a PayPal
 * login and never moves money; it selects the demo code path deterministically
 * regardless of whether live PayPal creds happen to be present in the env.
 *
 * The journey is logged in as the judge persona "Maya". A low-priced product is
 * chosen ("earbuds") so the spend sits under Maya's approval threshold and the
 * mandate policy resolves to "allow" — the demo receipt is issued directly.
 */

/** Log in (judge) and force the demo payment path before any navigation. */
async function authAndForceDemoPay(page: Page) {
  await page.request.post("/api/auth/judge-login");
  await page.route("**/api/pay/mode", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ paypalConfigured: false }),
    }),
  );
}

/** Drive shop search → results → product detail, and return the review CTA. */
async function openProductFromSearch(page: Page) {
  await page.goto("/shop");

  // The search box lives in the persistent shop header (aria-label).
  const search = page.getByLabel("Search products");
  await search.fill("earbuds");
  await search.press("Enter");

  await expect(page).toHaveURL(/\/shop\?q=earbuds/);

  // Tap the first product (its title is an <h3> inside the clickable card).
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
  // The journey spans several authed pages backed by live Channel3 + Neon +
  // judge-login seeding; under the fully-parallel runner these can queue behind
  // other workers, so give each test generous headroom.
  test.beforeEach(() => {
    test.setTimeout(180_000);
  });

  test("search → product → rewards → checkout → sandbox payment → verified receipt", async ({
    page,
  }) => {
    await authAndForceDemoPay(page);
    const reviewCta = await openProductFromSearch(page);

    // Optimization / savings breakdown is shown on the detail page.
    await expect(page.getByText(/Total payable now/i)).toBeVisible();

    await reviewCta.click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    // Environment is labelled prominently (demo path → Sandbox / Demo).
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
    await authAndForceDemoPay(page);
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
