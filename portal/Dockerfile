# syntax=docker/dockerfile:1

# Multi-stage build for the Next.js 16 hub. Produces a slim runtime image from
# Next's standalone output (output: "standalone" in next.config.ts).
#
# Debian slim (not Alpine): the runtime hosts the GitHub Copilot CLI for the
# Playground, and Copilot CLI + some native deps ship glibc binaries that don't
# run on musl.

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable

# --- deps: install with the frozen lockfile -------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- builder: compile the app --------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runner: minimal production image ------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

# GitHub Copilot CLI — invoked by /api/playground (per-user token passed at
# request time). COPILOT_COMMAND overrides the binary name if needed.
RUN npm install -g @github/copilot

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
