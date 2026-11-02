import { describe, it, expect } from "vitest";
import { usdToInrDisplay } from "./fx";

// Sample test — proves the Vitest harness runs. Real coverage for the
// optimizer / policy / receipts lives beside each module. See CONTRIBUTING.md.
describe("fx.usdToInrDisplay", () => {
  it("converts USD to INR at the given pinned rate", () => {
    expect(usdToInrDisplay(10, 84)).toBe(840);
  });

  it("rounds to 2 decimal places", () => {
    expect(usdToInrDisplay(1.005, 84)).toBe(84.42);
  });
});
