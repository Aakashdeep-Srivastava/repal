# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# RePal — production image for the Next.js 15 web service (frontend + API).
#
# Multi-stage: deps → builder → runner. The runner ships only Next's standalone
# output (server.js + a traced minimal node_modules) plus static assets and the
# generated Prisma client, running as a non-root user. Prisma's query engine is
# generated INSIDE the alpine builder so the musl/openssl3 engine binary matches
# the runtime base — no cross-platform engine mismatch.
#
# Target: AWS App Runner (expects the container to listen on $PORT, default 8080).
# See docs/DEPLOY_AWS.md.
# ─────────────────────────────────────────────────────────────────────────────

# ---- deps: install node_modules once, cached on lockfile ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: prisma generate + next build (standalone) ----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate the Prisma client (musl engine) and build the standalone server.
RUN npx prisma generate
RUN npm run build

# ---- runner: minimal production runtime ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# App Runner routes traffic to $PORT; bind all interfaces so it's reachable.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Next standalone server (includes its own traced node_modules + server.js).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public files are not part of standalone's trace.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Ensure the generated Prisma client + query engine are present at runtime
# (the engine binary is not always captured by Next's file tracing).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Schema + migrations, so `prisma migrate deploy` can be run from this image.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 8080

# Standalone entrypoint. Reads PORT/HOSTNAME from the env set above.
CMD ["node", "server.js"]
