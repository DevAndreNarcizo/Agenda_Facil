# SPEC-004 — Agenda operacional e disponibilidade

**Status:** implementada no ambiente de teste
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
5. [x] Painel usa uma camada única de disponibilidade para expediente, bloqueios, duração e concorrência.
6. [x] Reagendamento, filtros de profissional/status/período, paginação e E2E autenticado foram implementados e validados no projeto de teste.

## Etapa 1 implementada

- migration `20260815_000006_agenda_operational_foundation.sql` com tabela de bloqueios e constraints de exclusão por organização/profissional;
- Edge Function `manage-appointment`, publicada com JWT obrigatório, RBAC de owner/admin/employee, validação de payload e transições permitidas;
- calendário operacional com criação por seleção de slot, detalhe do evento, confirmação, conclusão e cancelamento;
- cancelamentos removidos de calendário, dashboard, carga da equipe e receita;
- normalização das métricas operacionais com `Intl` em `America/Sao_Paulo` e testes unitários.

## Etapa 2 implementada

- a RPC privada `manage_appointment_command` serializa comandos por organização, calcula a duração a partir do serviço e valida expediente, status, profissional e bloqueios;
- somente `service_role` pode executar a RPC ou alterar `appointments`/`appointment_blocks`; o browser autenticado mantém acesso apenas de leitura;
- reagendamento, criação/remoção de bloqueio, filtros por profissional/status, intervalo visível e paginação foram conectados ao calendário;
- Playwright cobre o fluxo autenticado de criar, reagendar, confirmar, concluir e cancelar;
- o script `test:e2e:concurrency` dispara duas requisições concorrentes autenticadas e exige exatamente uma resposta `200` e outra `409`.

## Operação de E2E

Os testes reais exigem credenciais exclusivas do projeto de teste em `.env.e2e` ou secrets do CI. Use `.env.e2e.example` como contrato; não registre senhas nem chaves no repositório. A execução local e o CI limpam apenas os agendamentos de concorrência aceitos, portanto a conta/organização E2E deve ser descartável.
