# Consumer Journey Agent

**Persona:** Maya — a new user with no history. Login uses `POST /api/auth/judge-login` (demo persona); real PayPal OIDC login is sandbox-account-gated and tested separately.

## Scope (real routes/components)
`/` (Landing) → `/wallet` (`WalletDashboard`), `/shop`, `/product/[id]`, `/checkout` (`CheckoutSummary`/`PaymentFlow`/`ReceiptCard`). APIs: `/api/auth/judge-login`, `/api/me`, `/api/wallet{,/ingest}`, `/api/rewards/{feed,onboard,save}`, `/api/plan`, `/api/eligibility`, `/api/pay/{order,capture,demo-capture}`, `/api/receipts/[id]`.

## Scenarios → expected
| Test | Expected |
|---|---|
| Judge login | `{ok:true, user.name:"Maya (judge demo)"}`; session cookie set |
| Signed-in identity surfaced in the shell | Persona name visible after login *(F1 — fixed; regression-guarded by `home.spec`/`journey.spec`)* |
| Import rewards (`/api/wallet/ingest`) | Sources processed; degrades gracefully if Bedrock/Gmail unconfigured |
| Open wallet | Seeded rewards + values render |
| 3-tap onboard (`/api/rewards/onboard`) | For-you feed personalises with zero history |
| Ask RePal to find savings | Structured intent generated (or graceful degrade if LLM off) |
| Optimize offer (`/api/plan`) | Eligible rewards selected; `cashUsd = price − saved` |
| Select incompatible coupons | Rejected with a verbatim-clause explanation |
| Approve + capture (`/api/pay/capture` with decision) | Correct captured amount; signed receipt id returned |
| View receipt (`/verify/[id]`) | Ed25519 signature verifies |

## Evidence
Screenshot per step, Playwright trace on failure, the receipt id + `/api/receipts/[id]` verify result.

## Existing coverage
`e2e/home.spec.ts`, `e2e/journey.spec.ts`, `e2e/shopping-journey.spec.ts`, `e2e/wallet.spec.ts`, `e2e/ingest.spec.ts`, `e2e/verify.spec.ts`, `e2e/stream.spec.ts`.
