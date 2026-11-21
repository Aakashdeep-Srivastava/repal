import { describe, it, expect } from "vitest";
import { handlePartnerRef, parseAction, referenceFor } from "./handler";

describe("handlePartnerRef", () => {
  it("rejects unauthorized callers", () => {
    expect(handlePartnerRef("confirm", { redemptionId: "r1" }, false)).toMatchObject({ status: 401 });
  });

  it("validate: code-less ok, blank code rejected, code normalized", () => {
    expect(handlePartnerRef("validate", { code: null }, true).json).toMatchObject({ valid: true, normalizedCode: null });
    expect(handlePartnerRef("validate", { code: "  " }, true).json).toMatchObject({ valid: false, reason: "empty_code" });
    expect(handlePartnerRef("validate", { code: "save10" }, true).json).toMatchObject({ valid: true, normalizedCode: "SAVE10" });
  });

  it("confirm: deterministic reference, DECLINE path, missing id", () => {
    const ok = handlePartnerRef("confirm", { redemptionId: "red_1", code: "SAVE10" }, true);
    expect(ok.json).toMatchObject({ confirmed: true, reference: referenceFor("red_1") });
    expect(handlePartnerRef("confirm", { redemptionId: "red_1" }, true).json.reference).toBe("PARTNER-REF-red_1");
    expect(handlePartnerRef("confirm", { redemptionId: "r", code: "DECLINE1" }, true).json).toMatchObject({
      confirmed: false,
      reason: "merchant_declined",
    });
    expect(handlePartnerRef("confirm", { code: "X" }, true)).toMatchObject({ status: 400 });
  });

  it("reverse: acknowledged", () => {
    expect(handlePartnerRef("reverse", { redemptionId: "r" }, true).json).toMatchObject({ ok: true });
  });

  it("parseAction only accepts the three known actions", () => {
    expect(parseAction("confirm")).toBe("confirm");
    expect(parseAction("bogus")).toBeNull();
    expect(parseAction(undefined)).toBeNull();
  });
});
