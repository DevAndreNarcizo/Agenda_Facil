# PILOT_CHECKLIST — Checklist de piloto (Fase G)

> Lista verificável para colocar o Agenda Fácil (nova stack) em staging e habilitar um piloto.
> Itens marcados ✅ já têm evidência automatizada; ⬜ exigem execução em ambiente real; ⛔ dependem de bloqueio externo.

## 1. Preparação de staging

- ⬜ Provisionar PostgreSQL 18 (fonte autoritativa) e storage privado S3-compatível (MinIO/S3).
- ⬜ `cp .env.example .env`, `php artisan key:generate`, configurar `DB_*`, `SANCTUM_STATEFUL_DOMAINS`, `APP_URL`, `FRONTEND_URL`.
- ⬜ `php artisan migrate --force` (valida índice parcial e constraint EXCLUDE — já coberto em CI contra PostgreSQL 18).
- ⬜ Semear demonstração: `php artisan db:seed --class=Database\\Seeders\\DemoSeeder` (dados **sintéticos**; login `demo@agendafacil.example`).
- ⬜ Build do Angular (`ng build`) e publicação; apontar a SPA para a API de staging.
- ⬜ HTTPS obrigatório; cookies de sessão `HttpOnly`/`Secure`; CORS/Sanctum com o domínio da SPA.

## 2. Qualidade / segurança (gate automatizado)

- ✅ CI Backend contra PostgreSQL 18: Pint + migrações + Pest (**56 testes / 148 asserções**).
- ✅ CI Angular: build de produção + testes.
- ✅ CI Qualidade (React): lint + testes + build + `npm audit` (0 vulnerabilidade de produção).
- ✅ Multi-tenancy: isolamento entre organizações (anti-IDOR/BOLA) testado.
- ✅ Billing: ciclo de vida sem os 10 defeitos do AUDIT; cotas não burláveis (testado).
- ✅ Portal: anti-enumeração de OTP, sessão opaca, isolamento entre orgs (testado).
- ✅ Agenda: anti-overlap por profissional (testado); lembretes idempotentes com lease/backoff (testado).
- ⬜ Rate-limit de autenticação/OTP/webhooks validado sob carga leve em staging.

## 3. Backup e restauração (DoD: "backups puderem ser restaurados")

- ✅ Round-trip de restauração testado na camada de aplicação (`tests/Feature/Operations/BackupRestoreTest.php`): snapshot → perda total simulada → restauração → contagens idênticas + IDs preservados.
- ⬜ Backup físico em staging: `DATABASE_URL=... backend/scripts/backup.sh` (gera `.dump` + `.sha256`).
- ⬜ Teste de restauração física: `TARGET_DATABASE_URL=<banco_de_teste> backend/scripts/restore.sh <arquivo.dump>` (NUNCA em produção).
- ⬜ Verificação pós-restauração: `php artisan tinker` conta `organizations`/`appointments`/`subscriptions` e confere com o backup.
- ⬜ Mover `.dump` para storage privado (S3) com política de retenção documentada.
- ⬜ Agendar backup periódico (cron) + teste de restauração mensal.

## 4. Operação

- ⬜ Scheduler ativo (`php artisan schedule:run` via cron) — executa `reminders:dispatch` a cada 5 min.
- ⬜ Fila (`queue:work`) somente se/quando necessária.
- ⬜ Logs sem segredos nem PII desnecessária (revisar antes do piloto).
- ⬜ Monitoramento básico (health `/up`, erros, latência da API).

## 5. Definition of Done — ponte para o piloto

| Critério (missão §11) | Estado |
|---|---|
| Organização se cadastra | ✅ backend + UI |
| Proprietário conclui onboarding | ✅ backend + UI |
| Profissionais e serviços cadastrados | ✅ backend + UI |
| Cliente externo reserva | ✅ backend + UI (`/reservar/:slug`) |
| Agendamento aparece na agenda | ✅ backend + UI |
| Plano reconhecido pelo servidor | ✅ |
| Cobrança sandbox confirmada | 🟡 provedor fake; ⛔ sandbox Stripe/Asaas (credenciais) |
| Renovação/falha/troca/cancelamento | ✅ (fake); revalidar em sandbox real |
| Limites não burláveis | ✅ |
| Org não acessa dados de outra | ✅ |
| Angular nos principais tamanhos de tela | 🟡 responsivo básico; QA visual pendente |
| Builds/testes/CI aprovados | ✅ 3 workflows verdes |
| Backups restauráveis | ✅ round-trip lógico testado; ⬜ físico em staging |
| Produção inalterada | ✅ nada remoto tocado |

## 6. Bloqueios externos (destravar com autorização)

1. Dump do Supabase vivo (migração de dados real — Fase C).
2. Sandbox Stripe/Asaas (ciclo real de billing).
3. Credenciais WhatsApp/Twilio (lembretes/OTP reais).

Enquanto não destravados, o piloto roda com provedores **fake** (billing/notificações) e dados **sintéticos** — suficiente para validar fluxo e UX, não para cobrança real.
