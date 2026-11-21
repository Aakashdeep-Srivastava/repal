import { describe, it, expect } from "vitest";
import { SandboxRedemptionAdapter } from "./sandbox";

const a = new SandboxRedemptionAdapter();
const base = { merchantId: "m1", userId: "u1", offerId: "o1" };

describe("SandboxRedemptionAdapter", () => {
  it("is labelled simulated on the adapter and every result", async () => {
    expect(a.simulated).toBe(true);
    expect(a.source).toBe("sandbox");
    expect((await a.confirm({ redemptionId: "r1", merchantId: "m1", netPaidCents: 100 })).simulated).toBe(true);
    expect((await a.reverse({ redemptionId: "r1", merchantId: "m1", reason: "x" })).simulated).toBe(true);
  });

  it("validates a code-less offer and normalizes a presented code", async () => {
    expect(await a.validate({ ...base, code: null })).toMatchObject({ valid: true, normalizedCode: null });
    expect(await a.validate({ ...base, code: "save10" })).toMatchObject({ valid: true, normalizedCode: "SAVE10" });
  });

  it("rejects a blank presented code", async () => {
    expect(await a.validate({ ...base, code: "   " })).toMatchObject({ valid: false, reason: "empty_code" });
  });

  it("confirms with a deterministic ref derived from the redemption id", async () => {
    const r = await a.confirm({ redemptionId: "red_abc", merchantId: "m1", netPaidCents: 2500, code: "SAVE10" });
    expect(r).toMatchObject({ confirmed: true, confirmationRef: "SANDBOX-red_abc", simulated: true });
    // deterministic — same input, same ref
    const r2 = await a.confirm({ redemptionId: "red_abc", merchantId: "m1", netPaidCents: 2500 });
    expect(r2.confirmationRef).toBe(r.confirmationRef);
  });

  it("declines a DECLINE-prefixed code (exercises the negative gate path)", async () => {
    const r = await a.confirm({ redemptionId: "red_x", merchantId: "m1", netPaidCents: 100, code: "decline-this" });
    expect(r).toMatchObject({ confirmed: false, reason: "merchant_declined", simulated: true });
    expect(r.confirmationRef).toBeUndefined();
  });
});
