# Build context: repository root.
#   docker build -f apps/web/Dockerfile .

# --- Build: static files from Vite ---
FROM node:24-slim AS build
RUN npm install -g pnpm@12.7.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@presidency-bingo/web

# --- Runtime: Caddy serves the SPA and proxies /api to the API container ---
FROM caddy:2
COPY --from=build /repo/apps/web/dist /srv
COPY infra/Caddyfile /etc/caddy/Caddyfile
