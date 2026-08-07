# ── Stage 1: Build ────────────────────────────────────────────────────────
FROM node:20.18.1-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Install dependencies before copying source so Docker caches this layer
COPY packages/frontend/package.json packages/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/frontend/ ./

# VITE_BACKEND_URL is baked into the JS bundle at build time.
# The browser uses this URL, so it must be reachable from the user's machine —
# not from inside Docker. Default: http://localhost:8000 (standard local setup).
ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN pnpm build

# ── Stage 2: Serve ────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
