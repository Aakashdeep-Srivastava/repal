# RePal — Team & Ownership

End-to-end ownership so no one steps on anyone. Each person owns their slice
front-to-back: code, tests, and the demo beat it powers. Cross-area changes
go through the owner (see `CODEOWNERS`).

We're building in **two phases**:
- **Phase 1 — get the spine running (now).** Aakash + rachan take the system
  end-to-end: login+mandate → intent → optimize → policy → pay-in → payout →
  signed receipt. Minimal agents/UI, just enough to run the full flow once.
- **Phase 2 — depth & polish (once the spine runs).** Aviral & Vishalika pick
  up the AI agents layer and the frontend/design system and build them out.

| Member | Phase | Slice | Owns (folders) |
| --- | --- | --- | --- |
| **Aakashdeep Srivastava** (lead) | 1 | PayPal money rails + orchestration glue + deploy | `lib/paypal/`, `agents/orchestrator.ts`, `app/api/pay/*`, `app/api/webhooks/*`, `app/api/auth/*`, `render.yaml`, CI, repo coordination |
| **Rachandeep Kaur** | 1 | **Backend domain services** | `lib/optimizer/`, `lib/policy/`, `lib/receipts/`, `lib/tnc/`, `lib/fx.ts`, `app/api/runs/*`, `app/api/mandates/*`, `app/api/wallet/*`, `app/api/offers/*`, `app/api/receipts/*`, `evals/` |
| **Aviral Srivastava** | 2 | AI agents layer **or** frontend (TBD when they join) | `agents/tools/*`, `agents/prompts/*`, `agents/memory.ts`, `workers/*`, `lib/channel3.ts` |
| **Vishalika** | 2 | Frontend & design **or** AI agents (TBD when they join) | `app/page.tsx`, `app/agent/*`, `app/wallet/*`, `app/insights/*`, `app/rescue/*`, `app/profile/*`, `app/verify/*`, `components/*`, `app/globals.css`, design system |

> Both Phase-2 slices are fully defined below. Which of Aviral / Vishalika takes
> which is decided when they join (after the spine runs). Fill the names into
> `CODEOWNERS` then.

**AI agents layer** — AI SDK 6 `ToolLoopAgent` tools: intent (A1), Terms agent +
grounding hookup (A2), Channel3 discovery (A3), explainer (A5), Cognee memory
(M), and the ingestion/expiry workers. Consumes `lib/` contracts; never computes
money.

**Frontend & design** — generative tool cards, wallet, AG Studio insights
dashboard (A10 widgets), Bryntum rescue timeline, the pixel-perfect design
system (PRD §12–13), PWA shell.

---

## Rachandeep Kaur — backend domain services (start here)

Your domain is the **deterministic core** — the part the whole product's
credibility rests on ("the LLM never computes money"). The type contracts are
already stubbed in `lib/types.ts`; implementations throw `not implemented` so
nothing silently returns fake numbers.

### Contracts you own (already scaffolded)
- `lib/types.ts` — shared domain types. **You're the steward.** Changing these pings the team.
- `lib/optimizer/{index,evaluate,stack}.ts` — SKU × reward joint optimization (branch-and-bound).
- `lib/policy/{index,mandate}.ts` — Intent + Cart mandate gate → `allow | ask | deny`.
- `lib/receipts/{index,verify}.ts` — canonical JSON → SHA-256 → Ed25519 (coordinate signing key with Aakash).
- `lib/tnc/{schema,groundingGuard}.ts` — predicate vocabulary + number-grounding guard.
- `lib/fx.ts` — ✅ implemented (display-only INR); your test pattern to copy.

### Suggested order (each lands as its own PR, test-first)
1. **`lib/policy`** — smallest, highest leverage, unblocks the approval gate.
   Implement `checkPolicy` (cap / threshold / allow-lists / expiry) + tests.
2. **`lib/tnc/groundingGuard`** — `assertGrounded`: every number in a rule must
   appear verbatim in the source T&Cs. Unblocks the Terms agent (A2).
3. **`lib/optimizer`** — `evaluateReward` → `bestStack` → `optimize`. Build the
   `evals/tnc-golden.json` fixtures alongside. The demo's "cheapest after
   rewards" moment is yours.
4. **`lib/receipts`** — `canonicalize` → `signReceipt` → `verifyReceipt`
   (Node `crypto`, Ed25519; no external deps). Powers `/verify/:id`.
5. **Domain API routes** — thin wrappers: `app/api/{runs,mandates,wallet,offers,receipts}`.
   Validate with Zod → call `lib/` → respond. SSE for `/api/runs/:id/stream`.

### Rules of the road
- Deterministic core imports **no** LLM SDK. Ever.
- Test beside the code (`*.test.ts`). Aim ~100% on optimizer/policy/receipts/tnc.
- Any rejection (reward or policy) must carry a **human-readable reason**, and
  for rewards, the **quoted clause**. That honesty is the product.

Ping Aakash for: the Ed25519 signing-key format, PayPal field shapes the
optimizer/policy need, and the SSE stream contract shared with the UI.
