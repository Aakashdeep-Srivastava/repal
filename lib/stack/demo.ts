// lib/stack/demo.ts — the user's RePal wallet for the hero demo (SAMPLE rewards, labelled in the UI).
// Nine rewards of different types, each with its own T&Cs. The agent checks every one against
// this payment; only those whose terms fit stack into one PayPal payment.
import type { PurchaseContext, Stackable } from "./compute";

export const DEMO_PRICE = 249.99;
export const DEMO_PRODUCT = { name: "Sony WH-1000XM5", merchant: "Best Buy", domain: "bestbuy.com" };
export const DEMO_CONTEXT: PurchaseContext = { domain: "bestbuy.com", category: "audio" };

const BBY = { merchantName: "Best Buy", domain: "bestbuy.com", onlyAt: ["bestbuy.com"] };

export const DEMO_WALLET: Stackable[] = [
  // ✓ saved offer: right store, right category, under cap
  { ...BBY, id: "bby-10", label: "Best Buy 10% off audio", kind: "Saved offer", type: "pct_off", value: 10, maxUsd: 40,
    onlyCategories: ["audio"], expiresInDays: 14, exclusiveCoupon: true, source: "Saved offer",
    clause: "10% off select headphones and speakers, up to $40. Cannot be combined with other coupons." },
  // ✗ wrong store
  { id: "tgt-20", label: "Target $20 off $100+", kind: "Coupon", merchantName: "Target", domain: "target.com",
    onlyAt: ["target.com"], type: "amount_off", value: 20, minSpendUsd: 100, expiresInDays: 10, source: "Saved offer",
    clause: "$20 off a $100+ home or electronics purchase. Target.com only." },
  // ✓ reward certificate (points earned earlier), expiring soon → used first
  { ...BBY, id: "bby-cert40", label: "My Best Buy $40 certificate", kind: "Certificate", type: "certificate", value: 40,
    expiresInDays: 6, source: "Gmail",
    clause: "Reward certificate: $40. Valid on any purchase in store or online. Expires in 6 days." },
  // ✗ minimum spend not met
  { id: "amex-bby30", label: "Amex Offer: $30 back", kind: "Card offer", merchantName: "Best Buy", domain: "americanexpress.com",
    onlyAt: ["bestbuy.com"], type: "statement_credit", value: 30, minSpendUsd: 300, expiresInDays: 20, source: "Amex",
    clause: "Spend $300 or more at Best Buy, get $30 back as a statement credit. Enrolled card only." },
  // ✓ gift card balance
  { ...BBY, id: "bby-gc15", label: "Best Buy gift card", kind: "Gift card", type: "gift_card", value: 15, source: "Gift card",
    clause: "Best Buy gift card balance $15. No expiry. Valid in store and online." },
  // ✗ wrong category
  { ...BBY, id: "bby-app15", label: "Best Buy 15% off appliances", kind: "Saved offer", type: "pct_off", value: 15,
    onlyCategories: ["appliances"], expiresInDays: 9, exclusiveCoupon: true, source: "Saved offer",
    clause: "15% off major appliances. Cannot be combined with other coupons." },
  // ✓ credit-card rewards spent at PayPal checkout (no store/category limit)
  { id: "pp-cardrw", label: "Card rewards via PayPal", kind: "Card rewards", merchantName: "PayPal", domain: "paypal.com",
    type: "card_rewards", value: 12.4, source: "PayPal",
    clause: "Use eligible credit card rewards on purchases when you check out with PayPal. No minimum." },
  // ✗ expired
  { ...BBY, id: "bby-5", label: "Best Buy $5 off", kind: "Coupon", type: "amount_off", value: 5, expiresInDays: -2, source: "Gmail",
    clause: "$5 off any purchase. Expires Nov 10." },
  // ✗ wrong store
  { id: "sbux-15", label: "Starbucks gift card", kind: "Gift card", merchantName: "Starbucks", domain: "starbucks.com",
    onlyAt: ["starbucks.com"], type: "gift_card", value: 15, source: "Gift card",
    clause: "Starbucks Card balance $15. Valid at Starbucks only." },
];
