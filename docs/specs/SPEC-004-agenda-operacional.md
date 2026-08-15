# SPEC-004 — Agenda operacional e disponibilidade

**Status:** proposta
**Prioridade:** P1

## Objetivo

Transformar o calendário de consulta em agenda capaz de criar, editar, cancelar e evitar conflitos reais.

## Requisitos

- CRUD de agendamentos com validação Zod e use cases;
- profissional obrigatório para negócios com equipe;
- expediente, pausas, bloqueios e timezone explícito `America/Sao_Paulo`;
- prevenção de sobreposição por organização/profissional no banco;
- estados `pending`, `confirmed`, `completed`, `cancelled` com transições autorizadas;
- calendário com ações acessíveis e filtros por profissional/status/período.

## Critérios de aceite

1. Duas reservas concorrentes no mesmo intervalo não são confirmadas.
2. Cancelamento não aparece como atendimento ativo ou receita.
3. Cliente e dashboard veem o mesmo horário normalizado.
