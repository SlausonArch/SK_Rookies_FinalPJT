FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG BUILD_SCRIPT=build
ARG NEXT_PUBLIC_APP_MODE=exchange
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_EXCHANGE_FRONTEND_URL
ARG NEXT_PUBLIC_BANK_FRONTEND_URL
ARG NEXT_SERVER_ACTION_ALLOWED_ORIGINS
ARG VITE_APP_MODE
ARG VITE_API_BASE_URL
ARG VITE_EXCHANGE_FRONTEND_URL
ARG VITE_BANK_FRONTEND_URL
RUN set -eu; \
    export NEXT_PUBLIC_APP_MODE="${NEXT_PUBLIC_APP_MODE:-${VITE_APP_MODE:-exchange}}"; \
    export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-${VITE_API_BASE_URL:-}}"; \
    export NEXT_PUBLIC_EXCHANGE_FRONTEND_URL="${NEXT_PUBLIC_EXCHANGE_FRONTEND_URL:-${VITE_EXCHANGE_FRONTEND_URL:-}}"; \
    export NEXT_PUBLIC_BANK_FRONTEND_URL="${NEXT_PUBLIC_BANK_FRONTEND_URL:-${VITE_BANK_FRONTEND_URL:-}}"; \
    if [ -z "${NEXT_SERVER_ACTION_ALLOWED_ORIGINS:-}" ]; then \
      export NEXT_SERVER_ACTION_ALLOWED_ORIGINS="$(printf '%s\n%s\n' "$NEXT_PUBLIC_EXCHANGE_FRONTEND_URL" "$NEXT_PUBLIC_BANK_FRONTEND_URL" | awk 'NF' | paste -sd, -)"; \
    fi; \
    npm run "$BUILD_SCRIPT"

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
ENV PORT=80
EXPOSE 80
CMD ["node", "server.js"]
