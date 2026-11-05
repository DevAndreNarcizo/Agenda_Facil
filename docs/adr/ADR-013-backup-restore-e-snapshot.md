# ADR-013 — Backup/restauração e snapshot lógico

**Status:** aceito
**Data:** 2026-11-05

## Contexto
A Definition of Done exige que "os backups puderem ser restaurados". Precisamos de um procedimento real para staging/produção e de uma verificação testável no CI (onde não há container PostgreSQL disponível).

## Decisão
Duas camadas complementares:

1. **Backup físico (staging/produção)** via `pg_dump -Fc` + `pg_restore` (`backend/scripts/backup.sh` e `restore.sh`), com checksum SHA-256 e restauração sempre em banco alvo separado (nunca produção). É o caminho de recuperação de desastre.

2. **Snapshot lógico (verificação testável + base de migração reversível)**: `Modules\Operations\Services\SnapshotService` exporta/importa as tabelas de domínio preservando IDs/relacionamentos. Um teste de round-trip (`BackupRestoreTest`) simula perda total e prova que a restauração reproduz contagens e IDs — rodando em CI contra PostgreSQL 18.

O snapshot lógico também serve de base para a migração de dados do Supabase (Fase C): copy-forward preservando IDs, reversível, sem tocar a origem.

## Consequências
- A DoD "backups restauráveis" tem evidência automatizada no CI, além do procedimento físico documentado.
- O `DemoSeeder` fornece dados **sintéticos** para staging/piloto sem depender de dados reais.
- `ponytail:` o snapshot lógico carrega o dataset em memória; para volumes de produção, o caminho é `pg_dump`/`pg_restore`. O snapshot é verificação de integridade e migração controlada, não substituto do backup físico.
