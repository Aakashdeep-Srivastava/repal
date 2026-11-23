import { describe, it, expect } from "vitest";
import {
  daysLeft,
  urgency,
  expiryLabel,
  isCashable,
  actionFor,
  summarizeRescue,
  filterRewards,
} from "./rescue";
import type { WalletReward } from "@/lib/schemas";

const NOW = Date.UTC(2026, 10, 23); // 2026-11-23, fixed so tests are deterministic
const DAY = 86_400_000;

function reward(p: Partial<WalletReward>): WalletReward {
  return {
    id: p.id ?? "r1",
    source: p.source ?? "gmail",
    type: p.type ?? "coupon",
    valueUsd: p.valueUsd ?? 0,
    termsRaw: p.termsRaw ?? "",
    status: p.status ?? "active",
    parseConfidence: p.parseConfidence ?? 1,
    expiresAt: p.expiresAt ?? new Date(NOW + 10 * DAY).toISOString(),
  };
}

describe("daysLeft / urgency / expiryLabel", () => {
  it("buckets by expiry window", () => {
    expect(urgency(reward({ expiresAt: new Date(NOW + 3 * DAY).toISOString() }), NOW)).toBe("critical");
    expect(urgency(reward({ expiresAt: new Date(NOW + 20 * DAY).toISOString() }), NOW)).toBe("soon");
    expect(urgency(reward({ expiresAt: new Date(NOW + 60 * DAY).toISOString() }), NOW)).toBe("later");
    expect(urgency(reward({ expiresAt: new Date(NOW - 2 * DAY).toISOString() }), NOW)).toBe("expired");
  });

  it("treats status:expired as expired regardless of date", () => {
    expect(urgency(reward({ status: "expired", expiresAt: new Date(NOW + 60 * DAY).toISOString() }), NOW)).toBe("expired");
  });

  it("labels days left honestly", () => {
    expect(expiryLabel(reward({ expiresAt: new Date(NOW).toISOString() }), NOW)).toBe("expires today");
    expect(expiryLabel(reward({ expiresAt: new Date(NOW + 1 * DAY).toISOString() }), NOW)).toBe("1 day left");
    expect(expiryLabel(reward({ expiresAt: new Date(NOW + 5 * DAY).toISOString() }), NOW)).toBe("5 days left");
    expect(expiryLabel(reward({ expiresAt: "not-a-date" }), NOW)).toBe("no expiry");
  });
});

describe("isCashable / actionFor", () => {
  it("only cash-like rewards with a value are cashable", () => {
    expect(isCashable(reward({ type: "giftcard", valueUsd: 25 }))).toBe(true);
    expect(isCashable(reward({ type: "cashback", valueUsd: 10 }))).toBe(true);
    expect(isCashable(reward({ type: "giftcard", valueUsd: 0 }))).toBe(false); // no value
    expect(isCashable(reward({ type: "coupon", valueUsd: 500 }))).toBe(false); // not cash-like
    expect(isCashable(reward({ type: "percent", valueUsd: 0 }))).toBe(false);
  });

  it("never offers cash-out for a non-cashable reward", () => {
    expect(actionFor(reward({ type: "giftcard", valueUsd: 25 })).kind).toBe("cash");
    expect(actionFor(reward({ type: "coupon", valueUsd: 500 })).kind).toBe("shop");
    expect(actionFor(reward({ type: "percent" })).label).toMatch(/use it/i);
  });
});

describe("summarizeRescue", () => {
  it("counts active/expiring and sums only cash value within 30 days", () => {
    const rewards = [
      reward({ id: "a", type: "giftcard", valueUsd: 25, expiresAt: new Date(NOW + 3 * DAY).toISOString() }), // critical, cash
      reward({ id: "b", type: "cashback", valueUsd: 10, expiresAt: new Date(NOW + 20 * DAY).toISOString() }), // soon, cash
      reward({ id: "c", type: "percent", valueUsd: 0, expiresAt: new Date(NOW + 5 * DAY).toISOString() }), // critical, no value
      reward({ id: "d", type: "giftcard", valueUsd: 100, expiresAt: new Date(NOW + 90 * DAY).toISOString() }), // later → excluded from value-at-risk
      reward({ id: "e", type: "giftcard", valueUsd: 50, status: "expired", expiresAt: new Date(NOW - DAY).toISOString() }), // expired
    ];
    const s = summarizeRescue(rewards, NOW);
    expect(s.activeCount).toBe(4); // a,b,c,d
    expect(s.expiringSoonCount).toBe(2); // a,c (≤7 days)
    expect(s.valueAtRiskUsd).toBe(35); // a(25)+b(10); c has no value, d is >30d, e expired
    expect(s.counts.expired).toBe(1);
  });
});

describe("filterRewards", () => {
  const rewards = [
    reward({ id: "a", expiresAt: new Date(NOW + 3 * DAY).toISOString() }),
    reward({ id: "b", expiresAt: new Date(NOW + 20 * DAY).toISOString() }),
    reward({ id: "c", expiresAt: new Date(NOW + 60 * DAY).toISOString() }),
    reward({ id: "d", status: "expired", expiresAt: new Date(NOW - DAY).toISOString() }),
  ];

  it("filters by window and sorts soonest-first, never showing expired", () => {
    expect(filterRewards(rewards, "7d", NOW).map((r) => r.id)).toEqual(["a"]);
    expect(filterRewards(rewards, "30d", NOW).map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterRewards(rewards, "all", NOW).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
