import { test, expect } from "@playwright/test";

test.describe("Home / agent shell", () => {
  test("renders the hero and nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/cheapest price/i);
    await expect(page.getByRole("link", { name: "Wallet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agent" })).toBeVisible();
  });

  test("agent flow handles the goal input (answer, or graceful 'blocked' until Bedrock is live)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Your shopping goal").fill("noise cancelling headphones under $250");
    await page.getByRole("button", { name: "Run" }).click();
    // Either a real answer (Bedrock configured) or the calm blocked note.
    await expect(
      page.getByText(/Bedrock model access|RePal.?s AI connects|rate limit|headphones/i),
    ).toBeVisible();
  });

  test("optimizer flow returns plans, or asks to connect Channel3", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Product category").fill("headphones");
    await page.getByRole("button", { name: "Find plans" }).click();
    // Plans rendered (cache/Channel3 available) OR the connect-Channel3 note.
    await expect(
      page.getByText(/Connect Channel3|offers considered|Cheapest after rewards|didn.?t apply/i),
    ).toBeVisible();
  });

  test("optimizer input is validated (empty category does nothing)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Find plans" }).click();
    // No results block appears for empty input (client-side guard + Zod).
    await expect(page.getByText(/offers considered/i)).toHaveCount(0);
  });
});
