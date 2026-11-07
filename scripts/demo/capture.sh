#!/usr/bin/env bash
# Sobe backend (SQLite + DemoSeeder) e SPA (build estático), tira screenshots e encerra tudo.
# Feito para ambientes onde processos em background não sobrevivem entre comandos.
# Uso: bash scripts/demo/capture.sh [dir_saida]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/docs/demo/screens}"
DB_FILE=/tmp/agenda_capture.sqlite

# Toolchain PHP do sandbox (no-op fora dele).
if [ -d /inner_container/usr/lib64 ] && [ -f "$ROOT/backend-dev-env.sh" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/backend-dev-env.sh"
fi

cd "$ROOT/backend"
export DB_CONNECTION=sqlite DB_DATABASE="$DB_FILE" BILLING_PROVIDER=fake NOTIFICATIONS_CHANNEL=fake
rm -f "$DB_FILE" && touch "$DB_FILE"
php artisan migrate:fresh --seed --seeder="Database\\Seeders\\DemoSeeder" --force >/tmp/capture-seed.log 2>&1

php -S 127.0.0.1:8000 -t public >/tmp/capture-api.log 2>&1 &
API=$!
node "$ROOT/scripts/demo/static-server.mjs" "$ROOT/frontend-angular/dist/frontend-angular/browser" 4200 >/tmp/capture-web.log 2>&1 &
WEB=$!
trap 'kill $API $WEB 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  curl -fs http://127.0.0.1:8000/up >/dev/null 2>&1 && curl -fs http://127.0.0.1:4200 >/dev/null 2>&1 && break
  sleep 1
done

node "$ROOT/scripts/demo/capture.mjs" "$OUT"
