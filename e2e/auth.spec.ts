import { test, expect } from "@playwright/test";

/**
 * Auth end-to-end: the demo-login session cycle (API) and the authed UI auth
 * controls. Both exercise the signed-cookie session in lib/auth/session.
 *
 * The marketing Landing (/) no longer carries a "Demo login" nav button — the
 * one-click sign-in is now the hero "Try Live Demo" CTA (judge persona "Maya"),
 * and Log out lives in the dashboard shell's account menu. The UI test drives
 * that real flow; the API test below is unchanged and still passes.
 */
test.describe("Authentication", () => {
  test("demo-login session cycle (API)", async ({ request }) => {
    // The `request` fixture persists cookies across calls within a test.
    let res = await request.get("/api/me");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).user).toBeNull();

    res = await request.post("/api/auth/demo-login");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).ok).toBe(true);

    res = await request.get("/api/me");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).user.userId).toBe("demo-user");

    res = await request.post("/api/auth/logout");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).ok).toBe(true);

    res = await request.get("/api/me");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).user).toBeNull();
  });

  test("log out from the account menu (UI)", async ({ page }) => {
    // Judge-login seeds the persona in Neon; under the fully-parallel runner that
    // write can queue behind other workers, so allow headroom.
    test.setTimeout(120_000);

    // Authenticate deterministically via the API — the "Try Live Demo" UI login
    // is covered by home.spec; here we exercise the LOGOUT control specifically
    // (a UI click can otherwise race page hydration before onClick is wired).
    await page.request.post("/api/auth/judge-login");
    await page.goto("/wallet");
    await expect(page).toHaveURL(/\/wallet/);
    // The signed-in persona "Maya" is shown in the dashboard.
    await expect(page.getByText(/Maya/).first()).toBeVisible();

    // Log out from the dashboard shell's account menu (in the visible sidebar).
    const sidebar = page.locator("aside:visible");
    await sidebar.getByText("PayPal Connected").click();
    await page.getByRole("button", { name: "Log out" }).click();

    // Back to the logged-out Landing.
    await expect(page.getByRole("button", { name: "Try Live Demo" }).first()).toBeVisible();
  });
});
