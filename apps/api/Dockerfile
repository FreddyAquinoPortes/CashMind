# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all deps (needed for build)
RUN npm ci --workspace=packages/shared --workspace=apps/api --include-workspace-root

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package first, then API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

# Copy workspace manifests for production install
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production deps only
RUN npm ci --workspace=packages/shared --workspace=apps/api --include-workspace-root --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy prisma schema & generate client
COPY apps/api/prisma ./apps/api/prisma
RUN cd apps/api && npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3001

ENV NODE_ENV=production

COPY apps/api/docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
