import { test, expect } from "@playwright/test";
import { E2E_RUN_ID } from "./global-setup";

test.describe("Agent run SSE stream", () => {
  test("replays status, tool traces, and plans as SSE events", async ({ request }) => {
    const res = await request.get(`/api/runs/${E2E_RUN_ID}/stream`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/event-stream");

    const body = await res.text();
    expect(body).toContain("event: status");
    expect(body).toContain("event: trace");
    expect(body).toContain("render_intent");
    expect(body).toContain("plan_purchase");
    expect(body).toContain("event: plans");
    expect(body).toContain("Cheapest after rewards");
    expect(body).toContain("event: done");
  });
});
