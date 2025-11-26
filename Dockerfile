# Multi-stage Dockerfile for Draehi Next.js app
# Build modes: dev (with debugging tools) or prod (lean)
ARG BUILD_MODE=dev

# Base stage with Node
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl

# Install development/debugging tools if in dev mode
RUN if [ "$BUILD_MODE" = "dev" ]; then \
      apk add --no-cache bash vim netcat-openbsd wget htop; \
    fi

WORKDIR /app

# Install Rust for export-logseq-notes
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install Rust tool
RUN cd modules/logseq/export-tool && cargo build --release
ENV CARGO_BIN_PATH="/app/modules/logseq/export-tool/target/release"

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/modules/logseq/export-tool/target/release/export-logseq-notes /usr/local/bin/

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
