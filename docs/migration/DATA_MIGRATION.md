# DATA_MIGRATION — Fase C: Supabase → PostgreSQL próprio

> Pipeline reversível e testável para migrar os dados do Supabase vivo para o PostgreSQL do novo backend, **preservando IDs/UUID e relacionamentos**. Copy-forward: a origem (Supabase) nunca é alterada.

## Estado

- ✅ **Pipeline implementado e testado** com dump sintético (3 testes em `backend/tests/Feature/Operations/SupabaseMigrationTest.php`).
- ⛔ **Execução real bloqueada** até a disponibilização do dump/credenciais do Supabase vivo (bloqueio externo; nenhum ambiente remoto é tocado sem autorização).

## Componentes

- `SupabaseMigrationService` — transforma o dump lógico (modelo legado) no modelo canônico.
- `MigrationReconciliationService` — confere contagens origem×destino e integridade (sem órfãos).
- `php artisan migrate:supabase <dump.json> [--dry-run]` — executa em transação única, idempotente.
- `SnapshotService` — export/import lógico do banco próprio (base do round-trip de backup, ADR-013).

## Mapeamentos (ver `src/lib/database.types.ts`)

| Supabase (origem) | PostgreSQL próprio (destino) |
|---|---|
| `profiles` (owner/admin/employee) | `users` (senha **nula** → redefinição) + `memberships` (papel) |
| `profiles` com papel (employee/owner/admin) | também vira `professionals` (preserva o id do profile) |
| `organizations.{plan_name, subscription_status, stripe_*, trial_end}` | `subscriptions` (+ `billing_customers` se houver `stripe_customer_id`) |
| `services.price` (reais) | `services.price_cents` (×100) |
| `appointments.employee_id` (→profiles) | `appointments.professional_id` (→professionals) |
| `appointments.status` (canceled/cancelled) | status canônico (`cancelled`) |
| `organization_business_hours` | `business_hours` |
| `customers.phone` | `customers.phone` + `phone_normalized` (dígitos) |

**Senhas:** os hashes do GoTrue (Supabase Auth) **não** são presumidos compatíveis com o `Hash` do Laravel. O import cria usuários com senha **nula** → fluxo de redefinição no primeiro acesso.

**Billing:** nada do Stripe é apagado. As assinaturas são derivadas dos campos inline da organização; a **reconciliação contra o gateway** é passo separado antes do cutover (ver `docs/billing/SUBSCRIPTIONS.md`).

## Procedimento (quando o dump estiver disponível)

1. **Extrair o dump** do Supabase como JSON por tabela (ex.: via API REST com a service_role key, ou export do painel), no formato:
   ```json
   {
     "profiles": [ ... ], "organizations": [ ... ], "organization_settings": [ ... ],
     "services": [ ... ], "customers": [ ... ], "appointments": [ ... ],
     "organization_business_hours": [ ... ]
   }
   ```
2. **Validar sem persistir:** `php artisan migrate:supabase dump.json --dry-run` (mostra contagens por tabela).
3. **Backup do banco alvo** antes de importar (`scripts/backup.sh`).
4. **Importar:** `php artisan migrate:supabase dump.json` — transação única; ao final imprime a reconciliação (contagens + órfãos). Falha (exit≠0) se houver divergência/órfãos.
5. **Pós-migração:** disparar e-mails de redefinição de senha; reconciliar billing contra o gateway; validar amostra de agendamentos/clientes.

## Reversibilidade

- O Supabase original permanece intacto (copy-forward). Rollback = descartar o banco novo e reimportar após correção; nenhuma perda na origem.
- O `migrate:supabase` é idempotente por IDs: reexecução sobre um banco já populado falha por chave duplicada (proposital) — reverter com `migrate:fresh` antes de reimportar em dev/staging.

## Bloqueio externo a destravar

Fornecer o dump JSON do Supabase (ou credenciais service_role para extração controlada). Sem isso, a lógica está pronta e provada; só falta a execução sobre os dados reais.
