#!/usr/bin/env bash
# Backup do PostgreSQL do Agenda Fácil. Formato custom (pg_restore), comprimido.
# Uso: DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/backup.sh [destino_dir]
# Requer pg_dump (cliente PostgreSQL) disponível no PATH.
set -euo pipefail

DEST_DIR="${1:-./backups}"
: "${DATABASE_URL:?Defina DATABASE_URL (postgres://...)}"

mkdir -p "$DEST_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${DEST_DIR}/agenda_facil_${STAMP}.dump"

echo "Gerando backup em ${OUT} ..."
# -Fc: formato custom (restaurável seletivamente); --no-owner/--no-privileges p/ portabilidade.
pg_dump "$DATABASE_URL" -Fc --no-owner --no-privileges -f "$OUT"

# Checksum para verificação de integridade.
sha256sum "$OUT" > "${OUT}.sha256"

echo "Backup concluído:"
echo "  arquivo:   ${OUT}"
echo "  checksum:  ${OUT}.sha256"
echo "Retenção: mova para storage privado (S3) e aplique política de retenção (ver docs/operations/DEPLOYMENT.md)."
