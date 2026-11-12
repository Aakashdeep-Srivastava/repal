// lib/offers/rank.ts
// Deterministic cold-start ranking for the "Rewards for you" feed.
// No LLM, no history needed. Signals in priority order:
//   1. pinned welcome reward  2. interests picked at onboarding
//   3. expiring soon  4. value  5. global popularity
// Once a user has receipts, add `historyAffinity` (same merchant/category) as signal 2b.

import { CATALOG, merchantById, type Audience, type CatalogOffer, type Category } from "../merchants/catalog";

export interface UserContext {
  daysSinceSignup: number;
  country: "US" | "IN";
  interests: Category[];                 // from the 3-tap onboarding step
  connections: { gmail: boolean; card: boolean };
  savedOfferIds: string[];
  merchantsOrderedFrom: string[];        // empty for a brand-new user
  historyCategories?: Category[];        // filled once receipts exist
}

export type Section = "welcome" | "for_you" | "popular" | "locked";

export interface RankedOffer {
  offer: CatalogOffer;
  section: Section;
  score: number;
  saved: boolean;
  why: string;                            // shown under the card; plain, honest
  estValueUsd: number;                    // for sorting + the "worth up to" pill
}

const LOCK_AUDIENCES: Audience[] = ["requires_gmail", "requires_card"];

/** Typical value of an offer on a $100 basket, capped by maxRewardUsd. Used only for ranking. */
export function estValue(o: CatalogOffer, basket = 100): number {
  let v = 0;
  if (o.type === "cashback_pct" || o.type === "pct_off") v = (o.value / 100) * basket;
  else if (o.type === "amount_off" || o.type === "welcome_cash") v = o.value;
  else if (o.type === "free_shipping") v = 5;
  if (o.maxRewardUsd != null) v = Math.min(v, o.maxRewardUsd);
  return Math.round(v * 100) / 100;
}

function eligible(o: CatalogOffer, u: UserContext): boolean {
  const m = merchantById[o.merchantId];
  if (!m) return false;
  if (!m.countries.includes(u.country) && !m.countries.includes("GLOBAL")) return false;
  if (o.audience === "new_user" && u.daysSinceSignup > 30) return false;
  if (o.audience === "first_order" && u.merchantsOrderedFrom.includes(o.merchantId)) return false;
  return true;
}

export function rankOffers(u: UserContext, catalog: CatalogOffer[] = CATALOG): RankedOffer[] {
  const out: RankedOffer[] = [];

  for (const o of catalog) {
    if (!eligible(o, u)) continue;
    const m = merchantById[o.merchantId];
    const ev = estValue(o);
    const saved = u.savedOfferIds.includes(o.id);

    // Locked: needs a connection the user hasn't made yet -> teaser card, not the offer itself.
    const locked =
      (o.audience === "requires_gmail" && !u.connections.gmail) ||
      (o.audience === "requires_card" && !u.connections.card);
    if (locked) {
      out.push({ offer: o, section: "locked", score: 0, saved: false, estValueUsd: ev,
        why: o.audience === "requires_gmail" ? "Connect Gmail to find gift cards you already own"
                                             : "Link a card to see offers from your card issuer" });
      continue;
    }

    const interest = u.interests.includes(m.category);
    const history = u.historyCategories?.includes(m.category) ?? false;
    const urgency = o.expiresInDays <= 7 ? 1 : o.expiresInDays <= 14 ? 0.5 : 0;
    const owned = LOCK_AUDIENCES.includes(o.audience); // came from Gmail/card = user already has it

    const score =
      (o.audience === "new_user" ? 1000 : 0) +
      (owned ? 400 : 0) +
      (interest ? 300 : 0) +
      (history ? 200 : 0) +
      urgency * 120 +
      Math.min(ev, 50) * 3 +
      o.popularity;

    const section: Section =
      o.audience === "new_user" ? "welcome" : interest || history || owned ? "for_you" : "popular";

    const why =
      o.audience === "new_user" ? "Welcome reward, paid to your PayPal"
      : owned ? `Found in your ${o.audience === "requires_gmail" ? "inbox" : `${o.network?.toUpperCase()} card`}`
      : interest ? `Because you picked ${m.category}`
      : history ? `You shop ${m.category} often`
      : o.audience === "first_order" ? `New-customer offer at ${m.name}`
      : urgency === 1 ? `Ends in ${o.expiresInDays} days`
      : "Popular with RePal members";

    out.push({ offer: o, section, score, saved, why, estValueUsd: ev });
  }

  // Locked teasers collapse to one per connection type.
  const seenLock = new Set<Audience>();
  return out
    .filter((r) => r.section !== "locked" || (!seenLock.has(r.offer.audience) && seenLock.add(r.offer.audience)))
    .sort((a, b) => b.score - a.score || a.offer.id.localeCompare(b.offer.id));
}

/** Group for the UI: Welcome -> For you -> Unlock more -> Popular. */
export function groupFeed(ranked: RankedOffer[]) {
  const by = (s: Section) => ranked.filter((r) => r.section === s);
  return { welcome: by("welcome"), forYou: by("for_you"), locked: by("locked"), popular: by("popular") };
}
