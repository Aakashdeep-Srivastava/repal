import { test, expect } from "@playwright/test";

/**
 * Capstone journey — the authed slice end to end in one real browser flow:
 *   log in from the Landing ("Try Live Demo") → land on the wallet → see the
 *   judge persona's rewards → exercise the wallet's live "Sync" control
 *   (re-collects from every connected source against live Neon) → log out.
 *
 * This complements the focused specs rather than repeating them:
 *   - auth.spec.ts  proves the login/logout session cycle (API + UI).
 *   - ingest.spec.ts proves multi-source collection + idempotency (API level).
 * Here we prove they are wired together through the actual UI.
 */

// Judge-login seeds the persona in Neon and the flow spans several authed pages;
// under the fully-parallel runner these live writes can queue, so allow headroom.
test.setTimeout(120_000);

test.describe("Journey: log in → sync wallet → log out", () => {
  test("log in from the Landing, sync rewards, see them stored, log out", async ({ page }) => {
    // 1. Start logged out; one-click sign-in from the Landing hero.
    await page.goto("/");
    await page.getByRole("button", { name: "Try Live Demo" }).first().click();

    // 2. Land on the wallet for the signed-in persona "Maya".
    await expect(page).toHaveURL(/\/wallet/, { timeout: 60_000 });
    await expect(page.getByText("Reward Wallet")).toBeVisible();
    await expect(page.getByText(/Maya/).first()).toBeVisible();
    // The seeded wallet shows reward value(s).
    await expect(page.getByText(/^\$\d/).first()).toBeVisible();

    // 3. Re-collect from every connected source via the wallet's Sync control.
    //    The REAL multi-source ingestion (live Neon + adapters) is asserted end
    //    to end in ingest.spec; here we only prove the wallet's Sync control is
    //    wired to it. We stub the ingest RESPONSE (not the control) so this UI
    //    test doesn't kick off a minute-long live collection that would contend
    //    with ingest.spec under the parallel runner — the click, the pending
    //    (disabled "Syncing…") transition, and the refetch are all still real.
    await page.route("**/api/wallet/ingest", async (route) => {
      await new Promise((r) => setTimeout(r, 1200)); // keep the in-flight state observable
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userId: "judge-maya",
          bySource: {
            gmail: { added: 0, updated: 1 },
            paypal: { added: 0, updated: 1 },
            card: { added: 0, updated: 1 },
          },
          totalAdded: 0,
          totalUpdated: 3,
          parsed: 3,
          unparsed: 0,
        }),
      });
    });

    // The button name flips "Sync" → "Syncing…", so match either with a prefix.
    const syncBtn = page.getByRole("button", { name: /^Sync/ });
    await expect(syncBtn).toBeEnabled();
    await syncBtn.click();
    // The control fires: it enters its in-flight (disabled "Syncing…") state…
    await expect(syncBtn).toBeDisabled();
    // …then settles back once the collection resolves.
    await expect(syncBtn).toBeEnabled();
    // Rewards remain visible after the sync.
    await expect(page.getByText(/^\$\d/).first()).toBeVisible();

    // 4. Log out from the dashboard shell's account menu → back to the Landing.
    const sidebar = page.locator("aside:visible");
    await sidebar.getByText("PayPal Connected").click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("button", { name: "Try Live Demo" }).first()).toBeVisible();
  });
});
