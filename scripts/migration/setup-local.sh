#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export LOCAL_UID="$(id -u)"
export LOCAL_GID="$(id -g)"

# Apenas ambiente sintético deste Compose. Não lê nem importa Supabase/Stripe.
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  chmod 600 apps/api/.env
fi
docker compose config --quiet
docker compose build api
docker compose up -d postgres mailpit
docker compose run --rm --no-deps -e COMPOSER_HOME=/tmp/agenda-composer api composer install --no-interaction --prefer-dist
if ! rg -q '^APP_KEY=.+$' apps/api/.env; then
  docker compose run --rm --no-deps api php artisan key:generate --force
fi
docker compose run --rm --no-deps web npm ci
docker compose run --rm api php artisan migrate --force
docker compose up -d api web
printf 'Ambiente local: http://localhost:4200 | API: http://localhost:8000 | email sintético: http://localhost:8025\n'
