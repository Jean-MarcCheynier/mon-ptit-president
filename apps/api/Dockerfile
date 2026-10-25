# Build context: repository root.
#   docker build -f apps/api/Dockerfile .

# --- Build: install the whole workspace, build the API and its workspace deps ---
FROM node:24-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.7.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@presidency-bingo/api
# Standalone copy of the API with production dependencies only.
RUN pnpm deploy --filter=@presidency-bingo/api --prod /out

# --- Runtime: compiled code + prod node_modules, non-root ---
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3000
# Apply pending migrations, then start.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
