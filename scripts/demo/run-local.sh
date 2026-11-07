#!/usr/bin/env bash
# Sobe a nova stack localmente para você ver e testar: Laravel (:8000, SQLite + DemoSeeder) + Angular (:4200).
# Requisitos: PHP 8.4 + Composer e Node 22 no PATH. Dados 100% SINTÉTICOS.
# Uso: ./scripts/demo/run-local.sh      (Ctrl+C encerra os dois)
#
# Login demo (dono):   demo@agendafacil.example / demo-staging-123
# Reserva pública:     http://localhost:4200/reservar/studio-demo   (telefone do cliente demo: 11988887777;
#                      o código OTP aparece na tela em ambiente local)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_FILE="${DEMO_DB:-/tmp/agenda_demo.sqlite}"

cd "$ROOT/backend"
composer install --no-interaction --prefer-dist
[ -f .env ] || { cp .env.example .env; php artisan key:generate --force; }

export DB_CONNECTION=sqlite DB_DATABASE="$DB_FILE" BILLING_PROVIDER=fake NOTIFICATIONS_CHANNEL=fake
rm -f "$DB_FILE" && touch "$DB_FILE"
php artisan migrate:fresh --seed --seeder="Database\\Seeders\\DemoSeeder" --force

php -S 127.0.0.1:8000 -t public &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT INT TERM

cd "$ROOT/frontend-angular"
npm install --no-audit --no-fund --prefer-offline  # garante dependências novas (ex.: fonte Inter)
echo ">> Commit em uso: $(git -C "$ROOT" rev-parse --short HEAD) (esperado >= 254bb48; se for anterior, rode git pull)"
echo ">> Abra http://localhost:4200  (login: demo@agendafacil.example / demo-staging-123)"
npx ng serve --port 4200
