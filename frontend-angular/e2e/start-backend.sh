#!/usr/bin/env bash
# Sobe o backend Laravel para os testes E2E com um SQLite efêmero (migrado + DemoSeeder).
# Usado pelo webServer do Playwright. PostgreSQL é a fonte autoritativa em produção;
# aqui o foco é a integração Angular<->API, e o SQLite basta (features pgsql-only são
# guardadas por driver e cobertas pelos testes Pest no CI contra PostgreSQL 18).
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/../../backend" && pwd)"
DB_FILE="/tmp/agenda_e2e.sqlite"

# PHP via mise (ambiente deste sandbox). Em CI, o PHP já está no PATH.
if [ -f "$BACKEND_DIR/../backend-dev-env.sh" ]; then
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/../backend-dev-env.sh"
fi
# Garante as libs do PHP do sandbox também para o processo final (exec serve).
if [ -d /inner_container/usr/lib64 ]; then
  export LD_LIBRARY_PATH="/inner_container/usr/lib64:${LD_LIBRARY_PATH:-}"
fi

cd "$BACKEND_DIR"

export DB_CONNECTION=sqlite
export DB_DATABASE="$DB_FILE"
export APP_ENV=local
export BILLING_PROVIDER=fake
export NOTIFICATIONS_CHANNEL=fake
export PORTAL_TOKEN_PEPPER=e2e-pepper

rm -f "$DB_FILE"
touch "$DB_FILE"

[ -f .env ] || { cp .env.example .env; php artisan key:generate --force; }

php artisan migrate:fresh --seed --seeder="Database\\Seeders\\DemoSeeder" --force

# Usa o servidor embutido do PHP direto (sem o subprocesso do `artisan serve`, que no
# sandbox reseta LD_LIBRARY_PATH e quebra o carregamento de libs do PHP do mise).
exec php -S 127.0.0.1:8000 -t public
