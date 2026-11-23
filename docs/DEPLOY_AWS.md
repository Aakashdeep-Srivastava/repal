# Deploying RePal on AWS (App Runner)

RePal's web service (Next.js 15 frontend + API) runs as a container on **AWS App
Runner** in the `reclevo.in` account (`413790912706`), region **us-west-2** —
co-located with the Neon DB and Bedrock. No EC2, no Kubernetes; App Runner is a
fully-managed container runtime (Fargate under the hood) that gives us an HTTPS
URL, TLS, and autoscaling with zero infra to babysit.

This is the **staging** deployment. It is the *web process only* — see
[§6 Worker & cron](#6-worker--cron-kept-independently-deployable) for why the
background jobs are deliberately not deployed yet and how they slot in later
without re-architecting.

---

## 0. Current staging stack — ECS Fargate + CloudFront

> **Why not App Runner (yet):** App Runner `CreateService` is blocked by an
> account-level hold on this new account (`"Account 413790912706 can't create
> new App Runner services."` — not a quota; the Services quota is 30). A support
> request to lift it is drafted (see the deploy scratchpad). Until it clears, the
> web service runs on **ECS Fargate** behind an **ALB**, with **CloudFront** in
> front for HTTPS — all managed, no EC2. The App Runner config (§1–§5 below) is
> fully staged and becomes a one-command deploy once the hold is lifted; the
> Fargate/ALB/CloudFront stack can then be torn down.

**Public URL: https://repal.shop** (primary, custom domain) · **https://d14t147d5f4q6i.cloudfront.net** (CloudFront origin, still live — the hackathon submission link).

| Resource | Name / ID |
|---|---|
| Custom domain | `repal.shop` + `www.repal.shop` → Route 53 hosted zone `Z0065647E1E211YNSCD7` → CloudFront aliases (apex = Alias A/AAAA, `www` = Alias A/AAAA) |
| ACM certificate | `repal.shop` + `www.repal.shop`, DNS-validated, **us-east-1** (CloudFront reads certs only from us-east-1), auto-renews |
| CloudFront distribution | `ECX7AU2KJOIDE` → `d14t147d5f4q6i.cloudfront.net` (HTTPS, redirect-to-https, caching disabled, forwards all); alternate domain names `repal.shop`, `www.repal.shop` |
| ALB (internet-facing) | `repal-alb` → `repal-alb-664958638.us-west-2.elb.amazonaws.com` (HTTP:80) |
| Target group | `repal-tg` (ip, 8080, health `/api/health`) |
| ECS cluster / service | `repal` / `repal-web` (Fargate, 1 vCPU / 2 GB, desired 1) |
| Task definition | `repal-web` |
| Execution role | `repal-ecs-execution` (ECR pull + `repal/*` secrets + logs) |
| Task role | `repal-ecs-task` (Bedrock invoke) |
| Security groups | `repal-alb-sg` (80 from world), `repal-svc-sg` (8080 from ALB SG) |
| Logs | CloudWatch `/ecs/repal-web` (14-day retention) |

**Request path:** viewer → `repal.shop` (Route 53) → CloudFront (TLS, ACM cert) → ALB:80 → Fargate task:8080.
HTTPS terminates at CloudFront (ACM cert for `repal.shop`/`www`, or the default
`cloudfront.net` cert on the origin URL); the browser-facing connection is HTTPS,
so `Secure` session cookies and PayPal webhooks/OIDC work on either host.

**Custom domain (added 2026-11-23):** DNS was moved off GoDaddy to **Route 53**
(nameservers delegated). The apex and `www` are **Alias A/AAAA** records to the
CloudFront distribution (hosted-zone id `Z2FDTNDATAQYW2`). The ACM cert lives in
**us-east-1** and was DNS-validated via a CNAME in the same zone. The CloudFront
URL stays fully functional. To make `repal.shop` the canonical OAuth callback
origin, `PAYPAL_OIDC_REDIRECT` is set to `https://repal.shop/api/auth/paypal/callback`
(see §PayPal below) — this single env var also drives the derived Gmail callback.

**Redeploy a new image (Fargate):**
```bash
# after build+push to ECR :latest
aws ecs update-service --profile reclevo --region us-west-2 \
  --cluster repal --service repal-web --force-new-deployment
```

**Hardening TODO (staging-acceptable to skip now):** the ALB currently accepts
`:80` from anywhere. To force traffic through CloudFront only, restrict the ALB
SG to the CloudFront origin-facing prefix list (`com.amazonaws.global.cloudfront.origin-facing`)
and/or require a shared secret header injected by CloudFront.

---

## 1. Why App Runner (and not ECS Fargate) today

The app, as it runs today, is a **single stateless HTTP container**: all durable
state is in Postgres, sessions are signed cookies, there are no background loops,
timers, local disk writes, or sticky connections. The logical three-part
topology (web + worker + cron) maps cleanly onto AWS: the worker is a one-shot
script (also reachable via `POST /api/wallet/ingest`) and the expiry cron runs
daily via EventBridge → `POST /api/cron/expiry`. So there is nothing that requires ECS's
service/scheduler machinery yet. App Runner covers 100% of what runs.

When the worker becomes long-running or the expiry cron is implemented, add them
as independent ECS Fargate workloads (§6) — App Runner for the web stays as-is.

---

## 2. AWS resources (all in us-west-2 unless noted)

| Resource | Name / ARN | Purpose |
|---|---|---|
| ECR repo | `repal-web` (`413790912706.dkr.ecr.us-west-2.amazonaws.com/repal-web`) | Holds the web image |
| App Runner service | `repal-web` | Runs the container, public HTTPS |
| IAM role (access) | `repal-apprunner-ecr-access` | Lets App Runner pull from ECR |
| IAM role (instance) | `repal-apprunner-instance` | Container's runtime identity: **Bedrock invoke** + read `repal/*` secrets. No AWS keys in env. |
| CodeBuild project | `repal-web-build` | Builds the Docker image in the cloud, pushes to ECR |
| IAM role (CodeBuild) | `repal-codebuild` | ECR push + logs + read source bucket |
| S3 bucket | `repal-build-413790912706` | CodeBuild source (zipped repo) |
| Secrets Manager | `repal/*` (8 secrets) | DB, receipt key, session, PayPal, Channel3 |

**Credentials model:** the running container has **no AWS access keys**. It
assumes the `repal-apprunner-instance` role, which grants exactly
`bedrock:InvokeModel[WithResponseStream]` on Claude and
`secretsmanager:GetSecretValue` on `repal/*`. App secrets are injected as env
vars from Secrets Manager at start; non-secret config is plain env on the
service.

---

## 3. Build → deploy flow (no local Docker required)

The image is built by **CodeBuild** (Docker isn't needed on your machine):

```bash
PROFILE="--profile reclevo --region us-west-2"
BUCKET=repal-build-413790912706

# 1. Zip the working tree (exclude node_modules/.next/.git/.env) and upload.
#    (On Windows this is done via robocopy + Compress-Archive — see scripts.)
aws s3 cp repal-src.zip "s3://$BUCKET/repal-src.zip" $PROFILE

# 2. Build + push to ECR (buildspec.yml does ECR login, docker build, push).
aws codebuild start-build $PROFILE --project-name repal-web-build

# 3. Tell App Runner to roll out the new :latest image.
aws apprunner start-deployment $PROFILE --service-arn <SERVICE_ARN>
```

`Dockerfile` is a multi-stage build (deps → builder → runner) that emits Next's
standalone server and runs as a non-root user on `node:20-alpine`, listening on
`$PORT` (8080). `buildspec.yml` tags the image `:latest` and `:<commit>`.

> **Migrations:** `npx prisma migrate deploy` against Neon `DIRECT_URL` is a
> separate, idempotent step (run locally or as a one-off task). The Neon
> production branch is currently up to date.

---

## 4. Service configuration

- **Port:** 8080 · **CPU/Mem:** 1 vCPU / 2 GB · **Autoscaling:** App Runner default.
- **Health check:** HTTP `GET /api/health` — a pure liveness probe (no external
  calls), so a Neon/Bedrock/PayPal/Channel3 blip never makes App Runner cycle
  healthy instances. Provider readiness lives at `/api/health/channel3` and
  `/api/health?deep=1` (DB ping).
- **Auto-deploy:** off. Deploys are explicit (`start-deployment`) so a push never
  surprises staging.
- **Service URL:** `https://d14t147d5f4q6i.cloudfront.net` _(filled after first deploy)_

---

## 5. PayPal wiring (after the URL exists)

PayPal needs the public URL, so this is done once the service is up. As of
2026-11-23 the canonical origin is **`repal.shop`** (the CloudFront URL stays
registered alongside, so both work):

1. **OIDC return URL:** set `PAYPAL_OIDC_REDIRECT` =
   `https://repal.shop/api/auth/paypal/callback` and add it as a return URL on the
   **default/platform** sandbox app's *Log in with PayPal* (PayPal Developer
   dashboard). Keep the `cloudfront.net` return URL registered too. This single
   env var is the app's public-origin source of truth — it also derives the Gmail
   callback (`/api/connect/gmail/callback`), the post-login redirect, the checkout
   return, and the mandates callback.
2. **Webhook:** register `https://repal.shop/api/webhooks/paypal` on the platform
   app, copy the generated **Webhook ID** into `repal/PAYPAL_WEBHOOK_ID`. Dedicated
   seller apps (Phase 2, e.g. `cleartrip`) are checkout-only and need a webhook
   only if `PAYPAL_WEBHOOK_ID__<MID>` is wired (none today).
3. **Google (Gmail OAuth):** add `https://repal.shop/api/connect/gmail/callback` as
   an authorized redirect URI and `https://repal.shop` as a JS origin on the OAuth
   web client; keep the cloudfront entries.
4. Redeploy so the new secret/env is picked up (CI renders
   `deploy/ecs-task-definition.json` on every deploy).

`POST /api/webhooks/paypal` verifies every event's signature server-side against
`PAYPAL_WEBHOOK_ID` and upserts by `event.id` (so duplicate deliveries are
idempotent).

---

## 6. Worker & cron (kept independently deployable)

Deliberately **not** deployed today (worker is one-shot; expiry cron is a stub).
When they become real, add them as independent AWS workloads — the web service is
untouched:

- **Ingestion worker** (`workers/ingest.ts`): if it stays short/triggered, run it
  as a one-off ECS Fargate task (or keep using `POST /api/wallet/ingest`). If it
  becomes continuous/high-volume, introduce **SQS** (enqueue ingest jobs) + an
  **ECS Fargate** service consuming the queue. No EC2.
- **Expiry cron** (`lib/rewards/expiry.ts`, exposed at `POST /api/cron/expiry`):
  scheduled daily (`0 2 * * *`) via **EventBridge Scheduler → Lambda → the cron
  endpoint** (optionally guarded by `CRON_SECRET`). Stateless, Postgres-only.

Both reuse the same image (or a slim worker image) and the same Secrets Manager
entries; only the entrypoint/command differs.

---

## 7. Logs & monitoring

- **Application logs:** App Runner streams stdout/stderr to CloudWatch
  (`/aws/apprunner/repal-web/.../application`). Prisma logs errors in production.
- **Service/deploy events:** `/aws/apprunner/repal-web/.../service`.
- **Build logs:** `/aws/codebuild/repal-web-build`.
- **Alarms (suggested):** CloudWatch alarm on App Runner `5xxStatusResponses` and
  on health-check failures; both are available as App Runner service metrics.

---

## 8. Security checklist

- Container has **no static AWS keys** — runtime identity is the instance role
  (least-privilege: Bedrock invoke + `repal/*` secrets only).
- All app secrets live in Secrets Manager, never in the image or git.
- `SESSION_SECRET` is a real 32-byte random value in prod (not the dev fallback).
- Cookies are `Secure` in production (`NODE_ENV=production`).
- Rotate the `repal-bedrock`/root keys and any exposed secret immediately on
  suspicion; see `docs/BEDROCK.md §7`.
