# SPEC-017 — Migração incremental para SaaS Angular/Laravel

**Status:** aprovada para execução local pelo pedido de missão de 25/10/2026; homologação externa pendente.
**Prioridade:** P0. Complementa SPECs 001–007 e ADRs 001–009; preserva seus invariantes.

## Situação e objetivo

Baseline `1f99af4` em `main`: React 19/Vite, Supabase Auth, RLS, comandos transacionais de agenda, portal opaco e outbox. Não existe Angular/Laravel. O histórico de testes remotos nos documentos não equivale a validação atual. Checkout/renovação não atendem ao ciclo comercial exigido. Migrar por estrangulamento, mantendo o React executável até paridade verificada.

## Contratos e invariantes

- Novos aplicativos independentes em `apps/web` (Angular 22 standalone, strict) e `apps/api` (Laravel 13, PHP >=8.4). PostgreSQL 18 em Compose isolado, sem importar ou consultar dados reais.
- API REST `/api/v1`; respostas de domínio `{data: ...}`; erros Laravel `{message, errors?}`. UUIDs para organizações, usuários e recursos preserváveis em futura importação.
- Sanctum para sessão SPA via cookie, sem token no localStorage. `/sanctum/csrf-cookie` antes de mutações de sessão; login regenera sessão e logout a invalida.
- `POST /auth/register` {name,email,password,password_confirmation}; `POST /auth/login` {email,password}; `POST /auth/logout`; `GET /auth/user` responde `{data:{user:{id,name,email},organization:null|{id,name,slug,timezone,primary_color},membership:null|{role},subscription:null|object}}`.
- `POST /onboarding` {name,slug,timezone?} transacional/idempotente por usuário; escolhe owner no servidor. A organização corrente vem da sessão e membership ativa consultada no servidor. Nunca aceitar tenant, role ou preço em payload genérico. Futura seleção explícita exige membership válida.
- `/services` {name,duration_minutes,price_cents}; `/professionals` {name}; `/customers` {name,email?,phone?}; GET/POST e mutações por UUID sempre escopadas ao tenant. Profissional não é conta de acesso.
- `/appointments` GET e POST {service_id,professional_id,customer_id,start_time}; `PATCH /appointments/{id}` para transição de status ou reagendamento validado. Duração/preço/organização calculados no servidor; transações e constraint de exclusão PostgreSQL impedem sobreposição. Instantes UTC, apresentação `America/Sao_Paulo`.
- `GET /public/{slug}` catálogo público mínimo; `POST /public/{slug}/bookings` {service_id,professional_id,start_time,customer:{name,email?,phone?}} com rate limit. Cliente novo deve conseguir reservar sem enumerar dados de outros clientes. Resposta mínima, sem dados privados da organização.
- `/dashboard` e `/analytics` agregados do tenant. Settings administrativos por owner/admin. Exportação e regularização continuam acessíveis quando a assinatura restringir novas operações.
- Billing: catálogo e versões no servidor; somente owner administra, nenhuma ativação por retorno do checkout. `BillingProvider` separa gateway; Asaas condicionado à homologação. Sem credenciais/autorização sandbox, responder indisponibilidade em vez de simular pagamento real.

## Arquivos, ordem e aceite

| Etapa | Responsabilidade/arquivos | Dependência e aceite | Validação |
|---|---|---|---|
| A | `docs/migration`, `docs/qa`; bundle local ignorado | Inventário código/commits/testes; backup Git verificável; sem acesso remoto | Scripts existentes `npm test`, `npm run lint`, `npm run build`; Deno shared tests; auditoria npm |
| B | `apps/api`, `apps/web`, `compose.yaml`, `infra/`, ADR-010 | Login/logout/cadastro/onboarding com Sanctum; React preservado | Comandos Laravel/Angular ainda ausentes no baseline; adicionar e executar `php artisan test`, `npm test`, `npm run build` nos aplicativos |
| C | migrations/models/middleware/policies/tests Laravel | Duas organizações isoladas; payload não promove papel; último owner preservado; UUIDs | Testes feature em PostgreSQL isolado, incluindo negativos |
| D | módulos e rotas lazy Angular; actions Laravel; OpenAPI | Cadastro de serviço/profissional/cliente → reserva pública → agenda, sem conflito | Feature tests; Playwright local e dimensões 390/768/1440; unitários Angular |
| E | Billing Laravel, catálogo, ledger, cotas | Eventos autenticados/idempotentes; trial único; pagamento confirma acesso; limites concorrentes | Testes locais de contratos/estados; sandbox externo bloqueado até configuração e autorização |
| F | CI, segurança, testes e acessibilidade | Gates verificáveis; falhas altas corrigidas ou bloqueiam piloto | Checks locais/CI configurada; CI remota somente após push autorizado |
| G | operations, rollback, status/acceptance | Restore sintético comprovado; procedimento reversível; riscos explícitos | Dump/restore de banco local e checks de Compose |

## Compatibilidade e fora do escopo

Não executar migrations no Supabase, não reescrever histórico, não remover React, não acessar Stripe/Asaas/Meta nem dados reais. Não copiar hashes/sessões de autenticação; futura migração exige convite de redefinição, revogação e reconciliação. Não implementar ERP, estoque, prontuário ou recursos avançados. Lista de espera e sinal ficam pós-núcleo. Valores e grace period locais são fixtures sintéticas, não política comercial aprovada.

## Riscos e dependências

Importação depende de snapshot autorizado e inventário Stripe/Supabase. Homologação de meios de pagamento, templates de mensagens, domínio/HTTPS, políticas de retenção/contrato e staging exigem decisões/configuração externas. O prazo de 15/12 é alvo condicionado aos gates; 31/01/2027 é limite de homologação, não promessa de prontidão. Desvios e resultados vão para `docs/implementation/STATUS.md` e `docs/qa/ACCEPTANCE_REPORT.md`.

## Continuação autorizada — paridade interna em 26/10/2026

O usuário pediu continuidade da mesma missão após os gates de 72 testes PHP, 14 Angular e E2E no Compose. A próxima etapa fecha lacunas existentes das SPECs 001/003/007, sem acessar dados ou provedores reais:

1. **Onboarding completo:** manter `POST /onboarding` compatível com `{name,slug,timezone?}` e acrescentar `profile?:{specialty?,instagram?,bio?}`, `address?:{postal_code?,street?,number?,city?,state?}`, `initial_service?:{name,duration_minutes,price_cents,category?}`, `business_hours?:[{day_of_week,start_time,end_time,is_active}]`. Persistir perfil/endereço em settings com allowlist, categoria no serviço, os sete dias e serviço inicial na mesma transação. Repetição não recria nada; erro não deixa estado parcial. A nova SPA preserva as seis etapas do legado: boas-vindas, perfil, endereço, serviço, horários e sucesso. Não consultar CEP em serviço externo por inferência.
2. **Membros/convites e contexto:** enriquecer `GET /memberships` com nome/email do membro do próprio tenant; `GET /memberships/invitations` lista convites sem hash/token; `DELETE /memberships/invitations/{id}` revoga sob autorização. Aceite continua por segredo de uso único e email autenticado. Interface mostra entrega manual explicitamente; link usa fragmento e token fica somente em memória. `GET /organizations` lista apenas memberships ativas do usuário; `POST /organizations/activate {organization_id}` verifica membership antes de gravar sessão. O ID é uma seleção solicitada, nunca autoridade de autorização. Troca de organização destrói a tela anterior antes de carregar dados do novo contexto.
3. **Logo:** `POST /branding/logo` recebe imagem via multipart, owner/admin, mesma validação do storage privado; `DELETE /branding/logo` remove a seleção pública sem excluir silenciosamente arquivos. A organização referencia arquivo do mesmo tenant por FK composta. `GET /public/{slug}/logo` publica apenas a imagem selecionada como marca do negócio, mantendo bucket/objetos privados e sem aceitar paths/IDs livres. A UI informa que o logo será visível na reserva pública. Outros arquivos continuam autenticados. API pública/contexto fornece `logo_url` ou null.

Arquivos: action/controller Organizations, MembershipController, modelos/migrations/feature tests; novo módulo Branding/rotas e integração Files; `onboarding-page`, páginas de membros/convite/organizações, settings, shell e respectivas rotas/testes Angular. Backend e branding têm migrations distintas; ninguém executa suites no mesmo DB de testes em paralelo.

Aceite: wizard cria dados completos e idempotentes; membro aceita/revoga convite e troca apenas para tenant autorizado; owner não perde propriedade por payload e último owner continua protegido; logo funciona publicamente só após seleção pelo gestor e arquivo de outro tenant é recusado; React permanece intacto. Validar por PHPUnit PostgreSQL, Angular strict/unit, E2E sintético no Compose e cobertura OpenAPI. As decisões comerciais e homologações externas permanecem pendentes.
