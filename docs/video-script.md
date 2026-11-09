# RePal — demo video script (~3 min)

Target: 2:45–3:00. Record against the live site
(https://d14t147d5f4q6i.cloudfront.net). Use the **Judge demo** account so there's
no login friction. Keep the "sample data" labels visible — never hide them.

> **AI note:** if AWS Bedrock access has cleared, run the agent box live. If it
> hasn't, drive the deterministic "Try it now — no AI needed" optimizer and the
> shop flow instead (both work with zero AI) — the story is identical and
> nothing is faked.

---

### 0:00–0:15 · Hook
**On screen:** a wallet of rewards (gift cards, cashback, points), a couple with
red "expires soon" badges.
**VO:** "You're sitting on money — gift cards, cashback, points — and most of it
quietly expires, because the terms are a maze and the value is trapped in a
dozen apps. RePal fixes that, and PayPal moves every dollar."

### 0:15–0:30 · One-click in
**Action:** click **Judge demo** → wallet fills with Maya's rewards.
**VO:** "One click signs you into a self-contained account — this is clearly
labelled sample data. Here's Maya's wallet."

### 0:30–1:15 · The agent + the deterministic optimizer
**Action:** type a goal — "noise-cancelling headphones under $250" — run it.
Show the plan: the cheapest SKU **after** applicable rewards, with the reward
that applied.
**VO:** "I state a goal in plain language. The AI reads the fine print of my
rewards — but it never does the math. A deterministic optimizer finds the
cheapest price *after* rewards, and a signed policy engine decides: allow, ask,
or deny — checked against my spending mandate."
**On screen:** point at the "allow / ask" badge and the mandate (cap, budget,
approval threshold).

### 1:15–1:45 · Pay-in → verifiable receipt
**Action:** approve an "ask" plan → it charges the PayPal **Vault** token
(Orders v2) → land on the signed **receipt**; open `/verify/:id`.
**VO:** "The mandate *is* a PayPal Vault token. On approval, PayPal captures the
payment and RePal issues a signed receipt — publicly verifiable, tamper-evident."

### 1:45–2:15 · Reward rescue → cash out (Payouts)
**Action:** open **/rescue** — the Bryntum timeline of rewards by expiry (red =
within a week). Cash out an expiring reward → PayPal **Payouts** → success +
receipt.
**VO:** "This timeline shows what's about to expire. One click liberates a stuck
reward into real cash through PayPal Payouts — bounded to the reward's value,
with its own signed receipt."

### 2:15–2:35 · Insights
**Action:** open **/insights** — KPIs + the AG Grid of receipts; sort, filter,
search.
**VO:** "Every dollar, after rewards — spend, savings, and cashback liberated,
all from signed data you can audit."

### 2:35–3:00 · The thesis
**On screen:** a one-line architecture card — AI reads/plans, deterministic core
computes, PayPal moves money; plus the sponsor logos (PayPal Agent Toolkit · AG
Grid · Bryntum).
**VO:** "Remove PayPal and the agent can't act, get paid, or pay you back —
identity, authority, pay-in, pay-out, reversal, all PayPal. And the rule that
makes an agentic money app safe: the LLM never computes an amount. That's RePal."

---

## Shot list / b-roll
- Wallet with expiry badges · mandate card · plan with allow/ask · `/verify/:id`
  receipt · `/rescue` timeline · payout success · `/insights` grid.
- Optional: terminal running `npm run paypal:mcp` + an MCP client listing PayPal
  tools (the Agent Toolkit integration), 3–4 seconds.

## Hard honesty rules
- Keep "sample data" labels on screen. Amounts are PayPal **sandbox**.
- Don't claim a feature that isn't live in the build you're recording. If a path
  is flagged off (e.g. real Gmail), don't show it as working.
