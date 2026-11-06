import { test, expect, type Page } from "@playwright/test";

/**
 * Live PayPal checkout: order → buyer approval on PayPal → return → capture.
 *
 * PayPal's hosted approval page can't be driven in CI, so only the PayPal edge
 * is stubbed: /api/pay/mode reports "live", /api/pay/order returns an order
 * whose `approveUrl` simulates PayPal redirecting the buyer straight back, and
 * /api/pay/capture is forwarded to /api/pay/demo-capture so a REAL server-signed
 * receipt is still issued. What's under test is the client flow: no capture
 * before approval, capture only for the matching token, cancel handling.
 */

const ORDER_ID = "TESTORDER123";

const product = {
  id: "e2e-approval",
  title: "E2E Approval Headphones",
  priceUsd: 49.99,
  retailer: "bestbuy.com",
  buyUrl: "#",
  category: "headphones",
};
const plan = {
  name: "Cheapest after rewards",
  offer: { id: product.id, title: product.title, priceUsd: 49.99, retailer: product.retailer, buyUrl: "#" },
  useRewards: [],
  savedUsd: 0,
  cashUsd: 49.99,
  policy: { decision: "allow", reasons: [] },
};

/** Seed the persisted journey (sessionStorage) as if the user picked a plan. */
async function seedJourney(page: Page) {
  await page.addInitScript(
    ([p, pl]) => {
      if (sessionStorage.getItem("repal-journey")) return; // keep state across the PayPal round-trip
      sessionStorage.setItem(
        "repal-journey",
        JSON.stringify({
          state: { query: "headphones", selectedProduct: p, eligibility: null, selectedPlan: pl, payment: "idle" },
          version: 0,
        }),
      );
    },
    [product, plan] as const,
  );
}

async function stubPayPal(page: Page, outcome: "return" | "cancel") {
  const calls = { order: 0, returned: false, capture: [] as { orderId: string; afterReturn: boolean }[] };
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame() && f.url().includes("paypal=return")) calls.returned = true;
  });
  await page.route("**/api/pay/mode", (r) => r.fulfill({ json: { paypalConfigured: true } }));
  await page.route("**/api/pay/order", (r) => {
    calls.order++;
    return r.fulfill({
      json: {
        id: ORDER_ID,
        status: "PAYER_ACTION_REQUIRED",
        // Simulates PayPal sending the buyer back after approve / cancel.
        approveUrl: `/checkout?paypal=${outcome}&token=${ORDER_ID}&PayerID=E2E`,
      },
    });
  });
  await page.route("**/api/pay/capture", async (r) => {
    const body = r.request().postDataJSON() as { orderId: string; decision: unknown };
    calls.capture.push({ orderId: body.orderId, afterReturn: calls.returned });
    const res = await r.fetch({
      url: r.request().url().replace("/api/pay/capture", "/api/pay/demo-capture"),
      postData: JSON.stringify({ decision: body.decision }),
    });
    return r.fulfill({ response: res });
  });
  return calls;
}

async function startPayment(page: Page) {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I confirm this order/i }).check();
  await page.getByRole("button", { name: /Pay with PayPal/i }).click();
}

test.describe("Live PayPal approval flow", () => {
  test("captures only after PayPal returns the buyer, then shows a signed receipt", async ({ page }) => {
    await seedJourney(page);
    const calls = await stubPayPal(page, "return");
    await startPayment(page);

    await expect(page.getByText(/Payment complete/i).first()).toBeVisible({ timeout: 25_000 });
    expect(calls.order).toBe(1);
    expect(calls.capture).toHaveLength(1);
    expect(calls.capture[0].orderId).toBe(ORDER_ID);
    // The fix: capture happens only AFTER the buyer came back from PayPal.
    expect(calls.capture[0].afterReturn).toBe(true);
    // Return query is stripped so a refresh can't re-capture.
    expect(page.url()).not.toContain("paypal=");

    await page.reload();
    await expect(page.getByText(/Payment complete/i).first()).toBeVisible();
    expect(calls.capture).toHaveLength(1);
  });

  test("cancelling on PayPal never captures and offers a retry", async ({ page }) => {
    await seedJourney(page);
    const calls = await stubPayPal(page, "cancel");
    await startPayment(page);

    await expect(page.getByText(/Payment cancelled/i)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("button", { name: /Retry payment/i })).toBeVisible();
    expect(calls.capture).toHaveLength(0);
  });
});
