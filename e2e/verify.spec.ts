import { test, expect } from "@playwright/test";
import { E2E_RECEIPT_ID } from "./global-setup";

test.describe("Public receipt verifier (sign → persist → verify, end-to-end)", () => {
  test("confirms a validly-signed receipt", async ({ page }) => {
    await page.goto(`/verify/${E2E_RECEIPT_ID}`);
    // Verified (key present) or "cannot verify here" (key absent) — never tampered.
    await expect(page.getByText(/Signature verified|Cannot verify here/i)).toBeVisible();
    await expect(page.getByText(/Signature INVALID/i)).toHaveCount(0);
    // The receipt's real fields are shown.
    await expect(page.getByText("Sony WH-1000XM5")).toBeVisible();
    await expect(page.getByText("bestbuy.com")).toBeVisible();
    await expect(page.getByText(/\$208\.00/)).toBeVisible(); // cash moved
  });

  test("handles a missing receipt", async ({ page }) => {
    await page.goto("/verify/does-not-exist-xyz");
    await expect(page.getByText(/Receipt not found/i)).toBeVisible();
  });
});
