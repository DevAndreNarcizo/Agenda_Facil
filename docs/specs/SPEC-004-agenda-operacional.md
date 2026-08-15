# SPEC-004 — Agenda operacional e disponibilidade

**Status:** em implementação — etapa 1 concluída no ambiente de teste
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

1. [x] Duas reservas concorrentes no mesmo intervalo não são confirmadas: constraints de exclusão no PostgreSQL e resposta `409` da Edge Function.
2. [x] Cancelamento não aparece como atendimento ativo ou receita: calendário, dashboard e métricas excluem `cancelled`.
3. [x] Dashboard e equipe calculam data/hora em `America/Sao_Paulo`.
4. [x] A agenda cria, confirma, conclui e cancela pelo calendário sem mutação direta do browser na tabela `appointments`.
5. [ ] Cliente e dashboard usam a mesma camada de disponibilidade, incluindo expediente, pausas e bloqueios.
6. [ ] Reagendamento, filtros de profissional/status/período e teste E2E autenticado estão concluídos.

## Etapa 1 implementada

- migration `20260815_000006_agenda_operational_foundation.sql` com tabela de bloqueios e constraints de exclusão por organização/profissional;
- Edge Function `manage-appointment`, publicada com JWT obrigatório, RBAC de owner/admin/employee, validação de payload e transições permitidas;
- calendário operacional com criação por seleção de slot, detalhe do evento, confirmação, conclusão e cancelamento;
- cancelamentos removidos de calendário, dashboard, carga da equipe e receita;
- normalização das métricas operacionais com `Intl` em `America/Sao_Paulo` e testes unitários.

## Pendências da etapa 2

- derivar a duração no servidor a partir do serviço e implementar reagendamento;
- validar expediente, pausas e `appointment_blocks` no mesmo use case transacional;
- aplicar filtros persistidos na URL e paginação/intervalo da consulta;
- executar E2E autenticado e teste de concorrência contra o projeto remoto de teste.
