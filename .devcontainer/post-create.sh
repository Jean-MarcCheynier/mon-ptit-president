#!/usr/bin/env bash
set -euo pipefail

pnpm install

# First run: start from the example env (localhost works thanks to the shared network).
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env

# Postgres only listens on TCP once its init scripts are done.
until (echo > /dev/tcp/localhost/5432) 2>/dev/null; do
  echo "Waiting for Postgres..."
  sleep 1
done

pnpm db:migrate
