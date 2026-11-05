/**
 * canonicalJson — deterministic JSON serialization used for hashing/signing.
 *
 * Rules:
 *  - object keys sorted lexicographically (recursively)
 *  - `undefined` object properties are omitted
 *  - array order is preserved
 *  - non-finite numbers (NaN, ±Infinity) and non-JSON values throw
 *
 * DETERMINISTIC. Shared by lib/receipts and lib/policy/mandate.
 * OWNER: Rachandeep Kaur.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export function canonicalJson(value: unknown): string {
  return serialize(value, "$");
}

function serialize(value: unknown, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error(`canonicalJson: non-finite number at ${path}`);
      }
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((v, i) => serialize(v, `${path}[${i}]`)).join(",")}]`;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error(`canonicalJson: unsupported object type at ${path}`);
      }
      const obj = value as Record<string, unknown>;
      const parts = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${serialize(obj[k], `${path}.${k}`)}`);
      return `{${parts.join(",")}}`;
    }
    default:
      throw new Error(`canonicalJson: unsupported ${typeof value} at ${path}`);
  }
}
