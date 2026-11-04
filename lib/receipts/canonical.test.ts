import { describe, it, expect } from "vitest";
import { canonicalJson } from "./canonical";

describe("canonicalJson", () => {
  it("sorts keys recursively regardless of insertion order", () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } });
    const b = canonicalJson({ a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}');
  });

  it("omits undefined properties but keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("preserves array order", () => {
    expect(canonicalJson(["b", "a"])).toBe('["b","a"]');
  });

  it("escapes strings like JSON", () => {
    expect(canonicalJson({ s: 'quote" ₹' })).toBe('{"s":"quote\\" ₹"}');
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite number %s", (n) => {
    expect(() => canonicalJson({ n })).toThrow(/non-finite/);
  });

  it("rejects non-plain objects and unsupported types", () => {
    expect(() => canonicalJson({ d: new Date(0) })).toThrow(/unsupported object/);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/unsupported function/);
    expect(() => canonicalJson({ b: BigInt(1) })).toThrow(/unsupported bigint/);
  });
});
