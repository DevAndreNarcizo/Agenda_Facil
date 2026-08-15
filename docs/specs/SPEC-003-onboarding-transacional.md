# SPEC-003 — Onboarding transacional e idempotente

**Status:** proposta
**Prioridade:** P1

## Objetivo

Persistir todos os dados coletados no onboarding em uma única operação idempotente e deixar o novo negócio pronto para operar.

## Requisitos

- uma função/Edge Function recebe dados validados: organização, slug, especialidade, endereço, horário, bio, Instagram e serviço inicial;
- cria organização, atribui owner, cria serviço e configuração de disponibilidade atomicamente;
- chamadas repetidas não criam duplicidade;
- slug é normalizado, único e reservado;
- falhas retornam erro de domínio sem estado parcial.

## Critérios de aceite

1. Repetir a requisição produz a mesma organização e serviço.
2. Todos os campos da interface têm persistência ou são removidos da interface.
3. Ao terminar, dashboard, página pública e agenda usam a mesma `organization_id`.
