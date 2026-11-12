// lib/merchants/catalog.ts
// Day-one offer catalog for RePal. A new user has no history, so this is what
// they see first (same pattern as the GPay "Offers" channel / PayPal savable offers).
//
// DEMO NOTE: every offer below is SAMPLE data (labelled "Sample offer" in the UI).
// In production these rows come from adapters (Rakuten Advertising /offers + /coupons,
// FlexOffers promo feed, PayPal Offers, card-linked-offer networks). The shape is the
// same, so swapping the source never touches the UI, ranking, or optimizer.

export type Category =
  | "electronics" | "groceries" | "dining" | "coffee" | "travel" | "fashion"
  | "beauty" | "home" | "pets" | "streaming" | "rides" | "marketplace";

export interface Merchant {
  id: string;          // slug
  name: string;
  domain: string;      // used for the logo lookup (Brandfetch by domain)
  category: Category;
  countries: ("US" | "IN" | "GLOBAL")[];
}

export type OfferType =
  | "cashback_pct"      // % back after purchase (paid as points/cash)
  | "pct_off"           // % off at checkout
  | "amount_off"        // $ off at checkout
  | "free_shipping"
  | "welcome_cash";     // RePal's own welcome reward, paid via PayPal Payouts

export type Audience =
  | "everyone"          // catalog offer, anyone can save it
  | "new_user"          // only during first 30 days on RePal
  | "first_order"       // first purchase at that merchant
  | "requires_gmail"    // revealed after Gmail connect
  | "requires_card";    // revealed after "Link card" (card-linked offer)

export interface CatalogOffer {
  id: string;
  merchantId: string;
  source: "repal" | "affiliate" | "paypal_offers" | "card_linked" | "seed";
  network?: "amex" | "visa" | "mastercard" | "discover"; // card-linked only
  type: OfferType;
  value: number;              // % for *_pct, USD for amount_off / welcome_cash
  minSpendUsd?: number;
  maxRewardUsd?: number;
  audience: Audience;
  termsRaw: string;           // free text -> Terms agent parses to rules
  expiresInDays: number;      // relative so the seed never goes stale
  popularity: number;         // 0-100, global saves; cold-start fallback signal
}

export const MERCHANTS: Merchant[] = [
  { id: "amazon",    name: "Amazon",      domain: "amazon.com",     category: "marketplace", countries: ["US", "IN"] },
  { id: "bestbuy",   name: "Best Buy",    domain: "bestbuy.com",    category: "electronics", countries: ["US"] },
  { id: "target",    name: "Target",      domain: "target.com",     category: "marketplace", countries: ["US"] },
  { id: "walmart",   name: "Walmart",     domain: "walmart.com",    category: "groceries",   countries: ["US"] },
  { id: "apple",     name: "Apple",       domain: "apple.com",      category: "electronics", countries: ["US", "IN"] },
  { id: "ebay",      name: "eBay",        domain: "ebay.com",       category: "marketplace", countries: ["US"] },
  { id: "starbucks", name: "Starbucks",   domain: "starbucks.com",  category: "coffee",      countries: ["US", "IN"] },
  { id: "doordash",  name: "DoorDash",    domain: "doordash.com",   category: "dining",      countries: ["US"] },
  { id: "dominos",   name: "Domino's",    domain: "dominos.com",    category: "dining",      countries: ["US", "IN"] },
  { id: "instacart", name: "Instacart",   domain: "instacart.com",  category: "groceries",   countries: ["US"] },
  { id: "uber",      name: "Uber",        domain: "uber.com",       category: "rides",       countries: ["US", "IN"] },
  { id: "nike",      name: "Nike",        domain: "nike.com",       category: "fashion",     countries: ["US", "IN"] },
  { id: "adidas",    name: "adidas",      domain: "adidas.com",     category: "fashion",     countries: ["US", "IN"] },
  { id: "macys",     name: "Macy's",      domain: "macys.com",      category: "fashion",     countries: ["US"] },
  { id: "sephora",   name: "Sephora",     domain: "sephora.com",    category: "beauty",      countries: ["US"] },
  { id: "homedepot", name: "The Home Depot", domain: "homedepot.com", category: "home",      countries: ["US"] },
  { id: "chewy",     name: "Chewy",       domain: "chewy.com",      category: "pets",        countries: ["US"] },
  { id: "petsmart",  name: "PetSmart",    domain: "petsmart.com",   category: "pets",        countries: ["US"] },
  { id: "expedia",   name: "Expedia",     domain: "expedia.com",    category: "travel",      countries: ["US"] },
  { id: "booking",   name: "Booking.com", domain: "booking.com",    category: "travel",      countries: ["GLOBAL"] },
  { id: "airbnb",    name: "Airbnb",      domain: "airbnb.com",     category: "travel",      countries: ["GLOBAL"] },
  { id: "spotify",   name: "Spotify",     domain: "spotify.com",    category: "streaming",   countries: ["GLOBAL"] },
  { id: "hulu",      name: "Hulu",        domain: "hulu.com",       category: "streaming",   countries: ["US"] },
  { id: "aliexpress",name: "AliExpress",  domain: "aliexpress.com", category: "marketplace", countries: ["GLOBAL"] },
  { id: "repal",     name: "RePal",       domain: "repal.app",      category: "marketplace", countries: ["GLOBAL"] },
];

export const CATALOG: CatalogOffer[] = [
  // ── Welcome (RePal-funded, paid out through PayPal Payouts) ─────────────
  { id: "welcome-5", merchantId: "repal", source: "repal", type: "welcome_cash", value: 5, minSpendUsd: 25,
    audience: "new_user", popularity: 100, expiresInDays: 30,
    termsRaw: "New RePal members get $5 back on their first agent-completed purchase of $25 or more within 30 days of sign-up. Paid to your PayPal balance after capture. One per person." },

  // ── Everyone (catalog; save to activate, like PayPal savable offers) ────
  { id: "bby-10", merchantId: "bestbuy", source: "affiliate", type: "pct_off", value: 10, maxRewardUsd: 40,
    audience: "everyone", popularity: 88, expiresInDays: 14,
    termsRaw: "10% off select headphones and speakers, up to $40. Excludes Apple and Bose. Cannot be combined with other coupons." },
  { id: "amz-cb3", merchantId: "amazon", source: "affiliate", type: "cashback_pct", value: 3, maxRewardUsd: 25,
    audience: "everyone", popularity: 92, expiresInDays: 30,
    termsRaw: "3% cash back on electronics sold by Amazon.com, up to $25 per order. Third-party sellers excluded. Cash back posts within 60 days." },
  { id: "tgt-20", merchantId: "target", source: "affiliate", type: "amount_off", value: 20, minSpendUsd: 100,
    audience: "everyone", popularity: 75, expiresInDays: 10,
    termsRaw: "$20 off a $100+ home or electronics purchase. Online only. Limit one per guest." },
  { id: "dd-10", merchantId: "doordash", source: "paypal_offers", type: "cashback_pct", value: 10, maxRewardUsd: 8,
    audience: "everyone", popularity: 81, expiresInDays: 7,
    termsRaw: "10% back on DoorDash orders paid with PayPal, up to $8. Save this offer and pay within 7 days. Taxes and tips excluded." },
  { id: "dom-20", merchantId: "dominos", source: "affiliate", type: "pct_off", value: 20, minSpendUsd: 20,
    audience: "everyone", popularity: 68, expiresInDays: 5,
    termsRaw: "20% off online carryout or delivery orders of $20 or more. Not valid with other coupons or on gift cards." },
  { id: "sbux-2x", merchantId: "starbucks", source: "affiliate", type: "cashback_pct", value: 5, maxRewardUsd: 5,
    audience: "everyone", popularity: 70, expiresInDays: 21,
    termsRaw: "5% back on Starbucks gift card reloads, up to $5 per month." },
  { id: "inst-ship", merchantId: "instacart", source: "affiliate", type: "free_shipping", value: 0, minSpendUsd: 35,
    audience: "everyone", popularity: 64, expiresInDays: 14,
    termsRaw: "Free delivery on orders of $35 or more. Service fees still apply." },
  { id: "nike-15", merchantId: "nike", source: "affiliate", type: "pct_off", value: 15,
    audience: "everyone", popularity: 72, expiresInDays: 12,
    termsRaw: "15% off full-price footwear. Sale items and Jordan excluded. Cannot be combined with other promo codes." },
  { id: "seph-cb4", merchantId: "sephora", source: "paypal_offers", type: "cashback_pct", value: 4,
    audience: "everyone", popularity: 66, expiresInDays: 20,
    termsRaw: "4% back in PayPal Rewards when you check out with PayPal. Gift cards excluded." },
  { id: "chewy-30", merchantId: "chewy", source: "affiliate", type: "pct_off", value: 30, maxRewardUsd: 20,
    audience: "first_order", popularity: 58, expiresInDays: 30,
    termsRaw: "30% off your first Autoship order, up to $20. New Chewy customers only." },
  { id: "exp-8", merchantId: "expedia", source: "affiliate", type: "cashback_pct", value: 8,
    audience: "everyone", popularity: 61, expiresInDays: 45,
    termsRaw: "8% back on hotel bookings. Flights, cars and packages excluded. Paid after check-out." },
  { id: "hd-10", merchantId: "homedepot", source: "affiliate", type: "amount_off", value: 10, minSpendUsd: 75,
    audience: "everyone", popularity: 49, expiresInDays: 9,
    termsRaw: "$10 off online orders of $75 or more. Excludes appliances and gift cards." },
  { id: "spot-3mo", merchantId: "spotify", source: "affiliate", type: "amount_off", value: 11.99,
    audience: "first_order", popularity: 55, expiresInDays: 25,
    termsRaw: "First month of Premium Individual free for new subscribers. Renews at standard price unless cancelled." },
  { id: "ali-8", merchantId: "aliexpress", source: "affiliate", type: "amount_off", value: 8, minSpendUsd: 40,
    audience: "first_order", popularity: 52, expiresInDays: 15,
    termsRaw: "$8 off a first international order of $40+. Ships from overseas. Settled in USD." },

  // ── Unlocked by connecting Gmail (gift cards / coupons the user already owns) ─
  { id: "gm-bby40", merchantId: "bestbuy", source: "seed", type: "amount_off", value: 40,
    audience: "requires_gmail", popularity: 0, expiresInDays: 6,
    termsRaw: "Best Buy reward certificate: $40. Valid on any purchase in store or online. Expires in 6 days. Not redeemable for cash." },
  { id: "gm-uber15", merchantId: "uber", source: "seed", type: "amount_off", value: 15,
    audience: "requires_gmail", popularity: 0, expiresInDays: 18,
    termsRaw: "Uber gift card balance $15. Valid on rides and Uber Eats." },

  // ── Unlocked by linking a card (card-linked offers; auto-apply on that card) ─
  { id: "cl-amex-apple", merchantId: "apple", source: "card_linked", network: "amex", type: "amount_off", value: 50, minSpendUsd: 250,
    audience: "requires_card", popularity: 0, expiresInDays: 20,
    termsRaw: "Amex Offer: spend $250 or more at apple.com, get $50 back. Enrolled card only. One per card." },
  { id: "cl-visa-dd", merchantId: "doordash", source: "card_linked", network: "visa", type: "cashback_pct", value: 5,
    audience: "requires_card", popularity: 0, expiresInDays: 30,
    termsRaw: "Visa offer: 5% back on DoorDash, up to $10. Not combinable with other card offers." },
  { id: "cl-mc-booking", merchantId: "booking", source: "card_linked", network: "mastercard", type: "cashback_pct", value: 6,
    audience: "requires_card", popularity: 0, expiresInDays: 40,
    termsRaw: "Mastercard offer: 6% back on Booking.com stays. International bookings eligible. Paid within 90 days." },
];

export const merchantById = Object.fromEntries(MERCHANTS.map((m) => [m.id, m]));
