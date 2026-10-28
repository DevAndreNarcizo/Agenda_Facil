# Auditoria de migração — Agenda Fácil

Data: 25/10/2026. Fonte examinada: clone de `DevAndreNarcizo/Agenda_Facil`, `main` em `1f99af46c8ee41b52d5d04ea0aab2277e6d1c572`. Branch de trabalho: `migration/saas-angular-laravel`. Clone inicialmente limpo, sem AGENTS.md próprio. Auditoria local: nenhum acesso a dados, credenciais ou serviços remotos. Evidências históricas em SPECs não foram revalidadas remotamente.

## Inventário comprovado por código

| Área | Estado no baseline | Evidência principal |
|---|---|---|
| React/Vite | React 19, TS 5.9, Vite 6; lazy routes; 12 áreas substanciais | `package.json`, `src/App.tsx` |
| Landing | Ausente; `/` redireciona para login | `src/App.tsx` |
| Auth | Email/senha, recuperação, provedores Google/WhatsApp condicionais; persistência por opção | `src/context/AuthContext.tsx`, `src/pages/auth`, `src/lib/auth-storage.ts` |
| Cadastro/onboarding | Server-side transacional; hardening de outubro ignora role/tenant em metadata | `20261005000001_signup_hardening.sql`, `complete-onboarding` |
| Tenant | Organizations canônico; um profile/tenant, sem memberships múltiplas, convites e transferência de owner completos | ADR-001, migrations, `create-employee` |
| Agenda | Operacional: criar, reagendar, confirmar, concluir, cancelar, bloqueios e filtros; comando servidor e exclusão GiST | SPEC-004, `manage-appointment`, migrations de disponibilidade |
| Clientes/serviços/equipe | CRUD real; profile confunde profissional e acesso; conta criada pelo gestor sem convite | hooks correspondentes, `create-employee` |
| Reserva pública/QR | Link por slug, catálogo/slots e QR existentes; reserva exige sessão de portal | `public-booking`, página pública, `public-booking-qr-code.tsx` |
| Portal | OTP, token opaco 256 bits, hash persistido, expiração e revogação server-side | funções `request/verify-portal-otp`, `portal-session` |
| Analytics | Agregações reais, SECURITY INVOKER e RLS no código recente | `20261004000001_panel_permissions_and_analytics.sql` |
| Marca/configurações | Tokens claros/escuros, logo/cor/horários; estilos stitch ainda em parte das telas | `src/index.css`, ADR-009, settings |
| Mensagens | Outbox, leases, deduplicação/retry e worker existem; envio externo não homologado nesta execução | SPEC-005, `_shared`, `send-reminders` |
| Billing | Stripe checkout + webhook autenticado/ledger; ciclo comercial incompleto | `create-checkout`, `stripe-webhook`, `SubscriptionPage.tsx` |
| Sinal/lista de espera | Foundation de depósitos; operação completa não comprovada; lista de espera proposta | SPECs 008–009, migrations |

Não foram encontrados mocks de produto nas páginas auditadas. Funcionalidade parcial/ausente não equivale a simulação. Preview do protótipo não prova implementação.

## Banco, segurança e integridade

Existem 19 migrations e 9 arquivos SQL de teste em `supabase/tests`. Não há `supabase/config.toml`. A migration `20260321_add_subscription_fields.sql` altera `companies`; a canônica exige `organizations/profiles` preexistentes. Os SQLs de raiz também usam companies: o conjunto não é bootstrap reproduzível em banco vazio. Não aplicar indiscriminadamente. O estado de dados, migration history e referências Stripe remotas é desconhecido.

Os commits `94449b4`, `999e2e1`, `a1b4c57` e `1f99af4` são posteriores às análises de agosto: já há grants por coluna, proteção de cadastro, analytics scoped e fontes locais. Não reintroduzir problemas corrigidos usando documentação antiga.

| Severidade | Achado e evidência | Consequência/ação |
|---|---|---|
| Crítica | `stripe-webhook/index.ts:132` marca active em checkout.session.completed sem verificar pagamento | Não habilitar billing comercial até confirmação/reconciliação corretas |
| Alta | `create-checkout/index.ts:142` cria sessão nova e trial 14 dias sempre | Duplicidade e reinício de trial; exigir checkout persistido/idempotência e trial único |
| Alta | Billing sem invoice.paid, renovação completa, faturas locais, cancelamento, estorno e reconciliação | Implementar domínio próprio e adapter homologável |
| Alta | Catálogo/cotas em `use-organization.ts:62`; sem enforcement | Price IDs já são privados no servidor; falta catálogo versionado e limites transacionais |
| Alta | Bootstrap SQL incompleto e `companies` legado | Nova base Laravel isolada; importação exige snapshot autorizado, IDs/FKs/reconciliação |
| Alta | `request-portal-otp:76` exige customer existente; público exige portal | Novo cliente externo não conclui primeira reserva |
| Alta | `portal-booking:69` faz insert privilegiado fora do comando central | Divergência de expediente, bloqueios/profissional e concorrência |
| Alta | `ThemeCustomization.tsx:104` orienta executar fix_all_rls.sql | Remover instrução administrativa perigosa da versão nova |
| Alta | npm audit de produção: zod <4.6.6, GHSA-mrhx-c7xc-m3w5 | Atualizar patch compatível e reexecutar gates |
| Média | OTP count+insert e attempts+1 sem lock | Rate limit/consumo devem ser atômicos |
| Média | canceled/cancelled misturados | Normalizar estado interno e guardar status bruto do gateway |
| Média | AuthContext sem geração/cancelamento; organização ausente vira Starter/trialing | Estado explícito de erro/sem tenant; impedir resposta de sessão atrasada |
| Média | Criação de conta com senha pelo gestor e console.error bruto | Convites expirados/revogáveis e logs minimizados |
| Média | Timezone parcialmente -03:00 fixo | Instantes timestamptz e timezone IANA por organização |

Autoria corporativa encontrada em hooks, CSS, config e testes. Novos arquivos e versões tocadas usam somente André Narcizo, sem reescrever histórico.

## Fluxos e dependências

Fluxo núcleo: cadastro → onboarding → serviço/profissional → disponibilidade → reserva pública → agenda → confirmação/cancelamento → lembrete. Fluxo comercial: catálogo → checkout → evento autenticado → pagamento/fatura → acesso/cotas → renovação/falha/regularização/cancelamento. Dependências externas: Supabase/Auth, Stripe, Meta/Twilio/WhatsApp, Netlify/storage e futuro Asaas. Não presumir credenciais, homologação ou renovação automática por Pix comum.

## Testes executados no baseline

| Comando | Exit | Evidência |
|---|---:|---|
| npm ci | 0 | 436 pacotes |
| npm test | 0 | 10 arquivos, 31 testes |
| npm run build | 0 | TypeScript e Vite |
| npm run lint | 0 | Sem erros |
| deno test --no-config --no-lock --no-npm supabase/functions/_shared/integrations.test.ts | 0 | 4 testes |
| npm audit --json | 1 | 12 vulnerabilidades: 7 high, 5 moderate |
| npm audit --omit=dev --audit-level=high | 1 | 1 high, zod |

Saídas integrais em `evidence/baseline-*.txt`. E2E legado/concorrência não executados: exigem credenciais e mutam Supabase remoto. Os 9 SQLs não executados: bootstrap local ausente. GitHub Actions não executado; job e2e usa secrets no if e precisa correção. CI não cobre Deno/SQL. Backup Git local criado em `.migration-backups/pre-migration-1f99af4.bundle` e `git bundle verify` exit 0; não é backup de banco remoto.

## Equivalência React → Angular

| Origem | Destino |
|---|---|
| App/React Router + ProtectedRoute | Router standalone lazy + guards auth/onboarding/permissão/assinatura |
| AuthContext/React Query | AuthService signal + HttpClient tipado, estados explícitos e interceptors |
| auth-ui/formulários | Reactive Forms tipados; cookies Sanctum/CSRF |
| DashboardLayout/panel | Shell responsivo e componentes/tokens --af-* |
| hooks services/customers/employees | Recursos REST; profissional separado de membership |
| calendário/agenda-model | Feature Scheduling e funções puras preservadas; comandos API |
| public booking/portal | Features públicas e portal separado; endpoint central de reservas |
| RPCs analytics | Queries Laravel scoped e apresentação pt-BR |
| use-organization/SubscriptionPage | Catálogo/versionamento/cotas/API Billing |

Identidade: azul #087BF5, navy #092343, Inter local, bordas finas, raios 10/12px; sidebar 232px ≥1100, rail 64px entre720–1099, navegação inferior <720. Autenticação já usa painel refinado; preservar estilos públicos existentes até paridade.

## Equivalência Supabase → Laravel

Auth/profiles → Identity UUID + Memberships e redefinição segura; organizations/settings/hours → OnboardingAction transacional; RLS/grants → contexto de sessão + policies e RLS como defesa adicional; create-employee → convites com token hash; manage_appointment_command → SchedulingAction + exclusão GiST; public/portal booking → mesma ação; OTP/sessão opaca → CustomerPortal cookie HttpOnly; Stripe → BillingProvider + ledger/estado reconciliável; message_deliveries → outbox/Queue após homologação; analytics → agregação scoped por timezone.

## Reversibilidade e estimativa

Aplicativos novos ficam em apps/, Compose e banco próprios; React e Supabase preservados. Antes de qualquer importação real: autorização, export criptografado, manifest/checksum, contagens/IDs/FKs/órfãos, histórico financeiro, restore isolado e reconciliação. Password reset substitui hashes/sessões legados. Cutover exige paridade, janela de escrita definida, rollback sem dupla fonte autoritativa e aprovação explícita.

Janela de execução: A/B até 01/11; C até 08/11; D até 29/11; E até 06/12; F e candidato a piloto até 15/12; G/staging e homologação de 16/12 a 31/01/2027. São estimativas condicionadas a escopo e homologações, não conclusão prometida. Detalhes e progresso em `MIGRATION_PLAN.md`, SPEC-017 e STATUS canônico.

Fontes técnicas consultadas em 25/10/2026: [Angular releases](https://angular.dev/reference/releases), [Laravel13](https://laravel.com/docs/13.x/releases), [Sanctum](https://laravel.com/docs/13.x/sanctum), [PostgreSQL](https://www.postgresql.org/support/versioning/), [Asaas assinaturas](https://docs.asaas.com/docs/assinaturas), [webhooks](https://docs.asaas.com/docs/sobre-os-webhooks), [Pix Automático](https://docs.asaas.com/docs/pix-automatico). Versões serão fixadas nos lockfiles, verificadas também nos registries.
