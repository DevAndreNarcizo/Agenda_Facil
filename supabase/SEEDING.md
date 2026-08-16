# Seed de desenvolvimento — Agenda Fácil

O seeder oficial é [`/var/www/Agenda_Facil/scripts/seed-demo.mjs`](/var/www/Agenda_Facil/scripts/seed-demo.mjs). Ele usa a **Auth Admin API** para criar contas funcionais, em vez de inserir registros diretamente em `auth.users`.

> **Nunca execute em produção.** Todos os registros são fictícios e o comando recria apenas as quatro contas `@agenda-facil.test`.

## Pré-requisitos

No `.env` de desenvolvimento/teste, configure:

```env
SUPABASE_SERVICE_ROLE_KEY=<somente ambiente local ou Supabase de teste>
SEED_DEMO_CONFIRM=I_UNDERSTAND_TEST_DATA
# Opcional: substitui a senha padrão de teste.
SEED_DEMO_PASSWORD=AgendaFacil!Teste2026
```

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` já são reutilizadas pelo comando. A service role nunca deve ser exposta no frontend nem enviada para o repositório.

## Executar

```bash
npm run seed:demo
```

O comando é idempotente: remove/recria apenas as contas de demonstração e faz `upsert` dos dados da organização.

## Contas de teste

| Papel | E-mail |
| --- | --- |
| Owner | `demo.owner@agenda-facil.test` |
| Admin | `demo.admin@agenda-facil.test` |
| Profissional | `demo.ana@agenda-facil.test` |
| Profissional | `demo.bia@agenda-facil.test` |

A senha é o valor de `SEED_DEMO_PASSWORD` ou, se não for definido, `AgendaFacil!Teste2026` **apenas em desenvolvimento**.

## Dados criados

- organização `Studio Aurora Demo` (`studio-aurora-demo`);
- quatro perfis, quatro serviços e seis clientes fictícios;
- horários de funcionamento, bloqueio de agenda e agendamentos em vários status;
- reserva pública ativada em `/reservar/studio-aurora-demo`.
