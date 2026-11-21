import { describe, it, expect } from "vitest";
import { AffiliateHttpAdapter } from "./affiliate";

describe("AffiliateHttpAdapter (unconfigured — the prod default today)", () => {
  const a = new AffiliateHttpAdapter(null);

  it("reports not-configured and is NOT simulated (never fabricates)", () => {
    expect(a.isConfigured()).toBe(false);
    expect(a.simulated).toBe(false);
    expect(a.source).toBe("affiliate:unconfigured");
  });

  it("declines without touching the network and never confirms", async () => {
    expect(await a.validate({ merchantId: "m1", userId: "u1", code: "X" })).toMatchObject({
      valid: false,
      reason: "adapter_not_configured",
    });
    const c = await a.confirm({ redemptionId: "r1", merchantId: "m1", netPaidCents: 100 });
    expect(c).toMatchObject({ confirmed: false, reason: "adapter_not_configured", simulated: false });
    expect(await a.reverse({ redemptionId: "r1", merchantId: "m1", reason: "x" })).toMatchObject({
      acknowledged: false,
      reason: "adapter_not_configured",
    });
  });
});
