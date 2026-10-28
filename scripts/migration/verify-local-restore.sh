#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."

# O alvo é fixo e local: este script nunca recebe uma URL ou nome de banco remoto.
backup_dir='.migration-backups'
restore_db="agenda_restore_$(date +%s)_$$"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
dump_path="$backup_dir/synthetic-restore.dump"
docker compose exec -T postgres pg_dump -U agenda_local -d agenda_facil -Fc > "$dump_path"
docker compose exec -T postgres createdb -U agenda_local "$restore_db"
cleanup() {
  docker compose exec -T postgres dropdb -U agenda_local --if-exists "$restore_db"
}
trap cleanup EXIT
docker compose exec -T postgres pg_restore -U agenda_local -d "$restore_db" --exit-on-error < "$dump_path"
count_sql="SELECT tablename || ':' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', tablename), false, true, '')))[1]::text FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
source_counts=$(docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U agenda_local -d agenda_facil -Atc "$count_sql")
restored_counts=$(docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U agenda_local -d "$restore_db" -Atc "$count_sql")
test "$source_counts" = "$restored_counts"
printf 'Restore sintético aprovado. Contagens iguais:\n%s\n' "$restored_counts"
sha256sum "$dump_path"
