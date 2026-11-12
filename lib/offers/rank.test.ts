import { describe, it, expect } from "vitest";
import { rankOffers, groupFeed, estValue, type UserContext } from "./rank";
import { CATALOG } from "../merchants/catalog";

const brandNew: UserContext = {
  daysSinceSignup: 0,
  country: "US",
  interests: ["electronics", "dining"],
  connections: { gmail: false, card: false },
  savedOfferIds: [],
  merchantsOrderedFrom: [],
};

describe("rankOffers — cold start (no history)", () => {
  it("gives a brand-new user a full, usable feed", () => {
    const feed = groupFeed(rankOffers(brandNew));
    expect(feed.welcome[0].offer.id).toBe("welcome-5"); // welcome pinned first
    expect(feed.forYou.length).toBeGreaterThanOrEqual(3); // interests alone fill For-you
    expect(feed.forYou.every((r) => ["electronics", "dining"].some((c) => r.why.includes(c)))).toBe(true);
    expect(feed.locked.length).toBe(2); // one teaser per missing connection, not per hidden offer
    expect(feed.popular.length).toBeGreaterThan(0);
  });

  it("promotes owned rewards above catalog offers once Gmail connects", () => {
    const f = groupFeed(rankOffers({ ...brandNew, connections: { gmail: true, card: false } }));
    expect(f.locked.length).toBe(1); // only the card teaser remains
    expect(f.forYou[0].offer.id).toBe("gm-bby40"); // expiring $40 cert the user owns ranks top
  });

  it("enforces eligibility: welcome window, first_order, country", () => {
    expect(rankOffers({ ...brandNew, daysSinceSignup: 45 }).some((r) => r.offer.id === "welcome-5")).toBe(false);
    expect(rankOffers({ ...brandNew, merchantsOrderedFrom: ["chewy"] }).some((r) => r.offer.id === "chewy-30")).toBe(false);
    expect(rankOffers({ ...brandNew, country: "IN" }).some((r) => r.offer.merchantId === "bestbuy")).toBe(false);
  });

  it("caps the value estimate at maxRewardUsd", () => {
    expect(estValue(CATALOG.find((o) => o.id === "bby-10")!, 1000)).toBe(40);
  });

  it("is deterministic", () => {
    expect(rankOffers(brandNew).map((r) => r.offer.id)).toEqual(rankOffers(brandNew).map((r) => r.offer.id));
  });
});
