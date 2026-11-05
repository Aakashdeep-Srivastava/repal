# PayPal Sandbox Setup

How to connect RePal to the PayPal **sandbox** and put your credentials in
safely. Sandbox only — no real money (`DEMO_MODE=true`).

> 🔒 **Secrets go in `.env.local` only.** That file is git-ignored. Never commit
> it, never paste these values into chat, PRs, or screenshots.

---

## 0. Where credentials live

```
.env.example   # template, committed — no real values
.env.local     # YOUR secrets, git-ignored — fill this one
```

If you don't have `.env.local` yet:

```bash
cp .env.example .env.local
```

Then fill the values below.

---

## 1. Create a sandbox REST app (gets CLIENT_ID + SECRET)

1. Go to **https://developer.paypal.com/dashboard/** and log in.
2. Top-right, make sure you're in **Sandbox** (not Live).
3. **Apps & Credentials → Create App**.
   - Type: **Merchant**. Name it e.g. `repal-sandbox`.
4. Open the app. You'll see:
   - **Client ID** → paste into `PAYPAL_CLIENT_ID`
   - **Secret** (click "Show" / generate `Secret key 1`) → paste into `PAYPAL_CLIENT_SECRET`
5. Scroll to **Features** and tick **Accept payments** and **Vault** (we store a
   mandate as a Vault payment token). Save.

```env
PAYPAL_CLIENT_ID=AaBbCc...your-sandbox-client-id
PAYPAL_CLIENT_SECRET=EEffGg...your-sandbox-secret
PAYPAL_ENVIRONMENT=SANDBOX
```

## 2. Sandbox test accounts (buyer + business)

- **Testing Tools → Sandbox Accounts.** PayPal auto-creates a `business` and a
  `personal` (buyer) account. Note their emails/passwords — you'll log in as the
  **personal** account during the demo to approve the mandate, and the
  **business** account receives pay-ins / is the Payouts source.
- You can set the personal account's balance here (used to show Payouts
  "reward liberation" landing in a real sandbox balance).

## 3. Verify the connection (smoke test)

With `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` filled:

```bash
npm run paypal:smoke
```

Expected:

```
→ Base URL: https://api-m.sandbox.paypal.com
[1/2] Fetching OAuth access token…  ✓ token acquired: ABCD…WXYZ
[2/2] Creating a $1.00 sandbox order…  ✓ order 5O1... — status CREATED
✅ Connected to PayPal sandbox.
```

That proves your credentials work and the Orders API is reachable. (It does not
capture — capture needs buyer approval or a Vault token, which come later.)

## 4. Webhook (for CHECKOUT/CAPTURE/PAYOUT events)

Needed once we deploy (events verify our pay-in / payout state).

1. In the app page → **Webhooks → Add Webhook**.
2. **Webhook URL:** your deployed URL + `/api/webhooks/paypal`
   (locally, use an ngrok/Render URL — PayPal can't reach `localhost`).
3. Subscribe to: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`,
   `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTSBATCH.SUCCESS`, and the
   refund events.
4. Copy the generated **Webhook ID** → `PAYPAL_WEBHOOK_ID`.

## 5. Other keys

- **Log in with PayPal (OIDC):** in the app, enable **Log in with PayPal**, set
  the **Return URL** to match `PAYPAL_OIDC_REDIRECT`
  (`http://localhost:3000/api/auth/paypal/callback` for local).
- **Receipt signing key** (Ed25519, base64) — generate one locally:

  ```bash
  node -e "const {generateKeyPairSync}=require('crypto');const {privateKey}=generateKeyPairSync('ed25519');console.log(privateKey.export({type:'pkcs8',format:'der'}).toString('base64'))"
  ```

  Paste the output into `RECEIPT_SIGNING_KEY`. (Coordinate with rachan — the
  receipt signer in `lib/receipts/` reads this.)

- **Channel3 / model keys** — `CHANNEL3_API_KEY`, `ANTHROPIC_API_KEY` (or
  `OPENAI_API_KEY`). Get from each provider's dashboard.

---

## Sharing with the team

Share sandbox credentials over our **private team channel**, never in the repo.
Each person keeps their own `.env.local`. For the shared deploy, the same keys
go into Render's env group (see `docs/TECH_PRD.md` §14), not into git.
