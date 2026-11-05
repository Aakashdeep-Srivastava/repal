import { test, expect } from "@playwright/test";

/**
 * Auth end-to-end: the demo-login session cycle (API) and the Nav auth
 * controls (UI). Both exercise the signed-cookie session in lib/auth/session.
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

  test("demo login / log out from the nav (UI)", async ({ page }) => {
    await page.goto("/");

    // Logged-out state: a "Demo login" control is shown.
    const demoLogin = page.getByRole("button", { name: "Demo login" });
    await expect(demoLogin).toBeVisible();

    await demoLogin.click();

    // Logged-in state: the user's name + a "Log out" control appear.
    await expect(page.getByText("Demo User")).toBeVisible();
    const logOut = page.getByRole("button", { name: "Log out" });
    await expect(logOut).toBeVisible();

    await logOut.click();

    // Back to logged-out state.
    await expect(page.getByRole("button", { name: "Demo login" })).toBeVisible();
  });
});
