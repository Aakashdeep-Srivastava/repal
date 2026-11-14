import { describe, it, expect, vi, afterAll } from "vitest";
import { z } from "zod";
import { liftToolkitTools, isPayPalToolkitEnabled } from "@/lib/paypal/toolkit";

describe("liftToolkitTools — the ai@4 → ai@7 shim", () => {
  it("re-wraps a toolkit tool's zod `parameters` as an ai@7 `inputSchema`", () => {
    const raw = {
      get_order: {
        description: "Get an order",
        parameters: z.object({ id: z.string() }),
        execute: vi.fn(async () => ({ ok: true })),
      },
    };
    const lifted = liftToolkitTools(raw);
    expect(Object.keys(lifted)).toEqual(["get_order"]);
    // The lifted tool is a v7 tool: carries inputSchema (not `parameters`).
    expect((lifted.get_order as { inputSchema?: unknown }).inputSchema).toBeTruthy();
    expect(lifted.get_order.description).toBe("Get an order");
  });

  it("delegates execute to the original toolkit tool", async () => {
    const execute = vi.fn(async (args: unknown) => ({ echoed: args }));
    const lifted = liftToolkitTools({
      list_disputes: { description: "d", parameters: z.object({}), execute },
    });
    const run = lifted.list_disputes.execute as (a: unknown, o: unknown) => Promise<unknown>;
    const result = await run({ page: 1 }, {});
    expect(execute).toHaveBeenCalledWith({ page: 1 });
    expect(result).toEqual({ echoed: { page: 1 } });
  });

  it("preserves every tool in the map", () => {
    const raw = {
      a: { description: "a", parameters: z.object({}), execute: vi.fn() },
      b: { description: "b", parameters: z.object({}), execute: vi.fn() },
      c: { description: "c", parameters: z.object({}), execute: vi.fn() },
    };
    expect(Object.keys(liftToolkitTools(raw))).toEqual(["a", "b", "c"]);
  });
});

describe("isPayPalToolkitEnabled — feature flag (off by default)", () => {
  const orig = process.env.PAYPAL_AGENT_TOOLKIT;
  afterAll(() => {
    process.env.PAYPAL_AGENT_TOOLKIT = orig;
  });
  it("is off unless explicitly enabled", () => {
    delete process.env.PAYPAL_AGENT_TOOLKIT;
    expect(isPayPalToolkitEnabled()).toBe(false);
    process.env.PAYPAL_AGENT_TOOLKIT = "0";
    expect(isPayPalToolkitEnabled()).toBe(false);
    process.env.PAYPAL_AGENT_TOOLKIT = "1";
    expect(isPayPalToolkitEnabled()).toBe(true);
    process.env.PAYPAL_AGENT_TOOLKIT = "true";
    expect(isPayPalToolkitEnabled()).toBe(true);
  });
});
