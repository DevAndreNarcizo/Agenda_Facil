# ADR-006 — Comandos de agenda passam pela Edge Function autorizada

**Status:** aceito
**Data:** 2026-08-15

## Contexto

Inserções e alterações feitas diretamente pelo browser permitiam contornar regras de transição, vínculo do profissional e tratamento consistente de conflito. A agenda passou a ter constraints de exclusão, mas o cliente ainda precisava de uma fronteira única para usar essas garantias.

## Decisão

Criação, confirmação, conclusão e cancelamento passam pela Edge Function `manage-appointment`, com `verify_jwt=true` e nova validação do token por `auth.getUser()`. A função consulta o perfil no servidor, aplica RBAC para `owner`, `admin` e `employee`, impõe o escopo da organização e traduz a violação PostgreSQL `23P01` em HTTP `409`.

O browser apenas envia comandos tipados para a função. O cancelamento é uma transição para `cancelled`, nunca exclusão física.

## Consequências

- Service Role permanece exclusivamente na Edge Function;
- transições inválidas e operações cross-tenant recebem erro antes da persistência;
- a constraint do banco continua como última defesa contra concorrência;
- a função deve evoluir para calcular duração por serviço e validar expediente/bloqueios antes de suportar reagendamento.
