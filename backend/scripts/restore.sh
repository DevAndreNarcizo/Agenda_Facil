#!/usr/bin/env bash
# Restauração testada do backup do Agenda Fácil.
# Uso: TARGET_DATABASE_URL=postgres://user:pass@host:5432/db_restore ./scripts/restore.sh arquivo.dump
# Restaura SEMPRE em um banco alvo separado (nunca em produção) para teste de restauração.
set -euo pipefail

DUMP="${1:?Informe o arquivo .dump}"
: "${TARGET_DATABASE_URL:?Defina TARGET_DATABASE_URL (banco de restauração, NUNCA producao)}"

if [ ! -f "$DUMP" ]; then
  echo "Arquivo não encontrado: $DUMP" >&2
  exit 1
fi

# Verifica integridade se houver checksum.
if [ -f "${DUMP}.sha256" ]; then
  echo "Verificando checksum ..."
  sha256sum -c "${DUMP}.sha256"
fi

echo "Restaurando ${DUMP} em ${TARGET_DATABASE_URL} ..."
# --clean --if-exists: idempotente; -1: transação única (tudo ou nada).
pg_restore --clean --if-exists --no-owner --no-privileges -1 -d "$TARGET_DATABASE_URL" "$DUMP"

echo "Restauração concluída. Valide com a verificação pós-restauração (ver PILOT_CHECKLIST.md)."
