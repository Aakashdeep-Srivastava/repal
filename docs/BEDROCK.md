# Claude on AWS Bedrock (reclevo.in account)

RePal's AI agents layer (the A0 orchestrator and the Terms agent) calls **Claude
through Amazon Bedrock**, in the `director@reclevo.in` AWS account, via the Vercel
AI SDK's Bedrock provider (`@ai-sdk/amazon-bedrock`).

**Prime directive:** the LLM never computes money. Bedrock backs only the
read / plan / explain / parse steps; every monetary calculation stays in the
deterministic, unit-tested `lib/` core. See `docs/TECH_PRD.md §3`.

> ⚠️ **Credentials are created by a human in the AWS console, never by code and
> never committed.** This doc is the runbook for minting a least-privilege key in
> the reclevo.in account and dropping it into `.env` (git-ignored). The app only
> ever *reads* the key from the environment (`lib/ai/bedrock.ts`).

---

## 0. This account, right now (reclevo.in · 413790912706)

**Chosen setup: Claude Haiku 4.5 in `us-west-2`** — co-located with the Oregon
Neon DB (`BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0`).

Verified by live `aws bedrock-runtime converse --profile reclevo` probes:

- **Model availability (same account, every region tested):**
  | Model | us-west-2 | us-east-1 | ap-south-1 | Verdict |
  |---|---|---|---|---|
  | **Haiku 4.5** | ✅ reachable | 🟡 form | 🟡 form | **our model** |
  | Opus 4.8 / Sonnet 5 | ❌ not available | ❌ not available | ❌ not available | need extra access — **region switch does NOT unlock them** |
  Opus 4.8 / Sonnet 5 return *"not available for this account — contact AWS
  Sales"* in **all** regions. Pursue that separately only if Haiku isn't enough;
  it's an access grant, not a config change.
- **The one gate is the Anthropic use-case form, NOT quota.** Models return
  `Model use case details have not been submitted for this account. Fill out the
  Anthropic use case details form`. → **Bedrock console (us-west-2) → Model access
  → request Anthropic Claude → fill the use-case form** (one-time; ~15 min).
  Console-only; no CLI.
- **Quota is a non-issue.** Per-minute defaults are ~**30,000,000 tokens/min**;
  the `0` in Service Quotas is the *applied* value that activates after access. Do
  **not** request an increase (the API rejects values below the 30M default).
- **us-east-2 (Ohio)** showed *"account is currently being verified"* (<2h
  new-account hold) — avoid until it clears; we use us-west-2 regardless.
- ⚠️ The `reclevo` profile currently uses **root-user access keys** — replace with
  a least-privilege IAM key or Bedrock API key (§2/§3) and delete the root keys.

---

## 1. Enable Claude model access (once per account + region)

1. Sign in to the AWS console as the **reclevo.in** account (or an IAM user in it)
   and pick a region that offers Claude — e.g. **us-east-1** or **us-west-2**.
   Use the **same region** everywhere (`AWS_REGION`).
2. **Bedrock → Model access → Manage model access** → request access to the
   Anthropic Claude models you need (Opus / Sonnet). Access is usually instant.
3. **Bedrock → Model access / Inference profiles** → copy the exact **model id**
   (or cross-region *inference profile* id, e.g. `us.anthropic.claude-...-v1:0`).
   That string goes in `BEDROCK_MODEL_ID` — the app does not hardcode it.

## 2. Credentials — pick ONE (Bearer key recommended)

### Option A — Bedrock API key (recommended, simplest)

A Bedrock API key is a bearer token scoped to Bedrock; no SigV4 plumbing.

1. **Bedrock → API keys → Generate** (choose **long-lived** for Render; or
   short-lived for local-only testing). It is tied to an IAM identity whose
   permissions should be the least-privilege policy in §3.
2. Copy the key **once** (you can't see it again) into `.env`:
   ```
   AWS_BEARER_TOKEN_BEDROCK=<the key>
   AWS_REGION=us-east-1
   BEDROCK_MODEL_ID=<id from step 1.3>
   ```

### Option B — least-privilege IAM user (access key + secret)

1. **IAM → Users → Create user** (e.g. `repal-bedrock`), *no console access*.
2. Attach the inline policy from §3.
3. **Create access key → Application running outside AWS**. Put it in `.env`:
   ```
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   BEDROCK_MODEL_ID=<id from step 1.3>
   ```

### Option C — ambient AWS chain (AWS-hosted only)

If RePal ever runs on AWS compute, attach an **IAM role** with the §3 policy and
set no keys — the provider picks up the instance/role credentials automatically.

## 3. Least-privilege IAM policy

Grant only model invocation on Claude — nothing else. Replace `ACCOUNT_ID`.
Cross-region inference profiles need **both** the foundation-model ARNs (for every
region the profile routes to) and the inference-profile ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RePalInvokeClaude",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:*:ACCOUNT_ID:inference-profile/*.anthropic.claude-*"
      ]
    }
  ]
}
```

Tighten `anthropic.claude-*` to the specific model families once the demo set is
fixed. Do **not** add `bedrock:*` or account-admin actions.

## 4. Where values live

| Var | Where | Shared? |
|---|---|---|
| `AWS_BEARER_TOKEN_BEDROCK` *or* `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` | `.env` | **SHARED** via the private team channel — never commit |
| `AWS_REGION`, `BEDROCK_MODEL_ID` | `.env` | SHARED |

Both `.env` and `.env.local` are git-ignored (see `docs/ENV.md`). Never paste a
key into chat, a PR, a commit, or an issue.

## 5. Verify

```
npm run bedrock:smoke
```
Expected: `RePal Bedrock OK` + a token-usage line = you're connected.
Common failures: `AccessDeniedException` → model access not enabled or policy too
tight; `ValidationException` on the model id → wrong `BEDROCK_MODEL_ID`/region.

## 6. Render deploy

Set the same env vars in the Render service (Environment tab). Prefer a
**long-lived Bedrock API key** or an IAM user access key — Render isn't AWS, so
there's no instance role to inherit. Rotate on exposure.

## 7. Security checklist

- Least-privilege only (§3); separate key per environment (dev vs prod).
- Rotate keys periodically and immediately on suspected exposure; revoke in IAM.
- Never log the key; `lib/ai/bedrock.ts` reads it from env and never prints it.
- Keep `BEDROCK_MODEL_ID` in env so switching models/regions never touches code.

## How the code uses it

- `lib/ai/bedrock.ts` — the provider + `claude` model handle, env-driven, with
  `assertBedrockConfigured()` as the fail-fast guard. **Provider only** — no
  prompts or tools here.
- `agents/` (AI agents layer) consume `claude` inside the ToolLoopAgent. Tools
  call the deterministic `lib/` functions; the model routes, it does not compute.
