import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Spins up the Next dev server, seeds a signed receipt (global
 * setup), and drives real browser flows. Tests assert live behavior for
 * connected services (home, wallet on Neon, receipt verify) and the correct
 * graceful-degradation for services not yet configured (Bedrock, Channel3).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // Cap workers: the suite drives live Neon + the dev server, and too many
  // concurrent heavy specs (e.g. multi-source ingestion) throttle the remote
  // DB into connection resets. 2 workers keeps it reliable.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
