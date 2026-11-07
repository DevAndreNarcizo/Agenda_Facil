# TENANT_MATRIX — Isolamento multi-tenant e autorização

> Modelo de multi-tenancy do backend Laravel e matriz de permissões por papel.
> O servidor é a autoridade: tenant, papel e acesso **nunca** vêm de parâmetros livres do navegador.

## Resolução de tenant

`App\Http\Middleware\ResolveTenantContext` resolve a organização a partir do **usuário autenticado + membership ativo**, não de um ID enviado pelo cliente. A organização alvo pode ser indicada por `X-Organization-Id`, mas o acesso só é concedido se existir membership ativo. Vínculos ambíguos (múltiplas orgs) exigem o cabeçalho explícito (409). O resultado fica em `TenantContext` (scoped por request); serviços/policies leem dali.

## Papéis (`Modules\Organizations\Enums\Role`)

`owner` · `admin` · `employee`. `isManager()` = owner|admin. `isOwner()` restringe administração de assinatura.

## Matriz de autorização (estado atual — Fase B/E)

| Recurso / ação | owner | admin | employee | anônimo |
|---|:---:|:---:|:---:|:---:|
| Cadastro próprio (auto-signup) | cria como **owner** sempre | — | — | ✅ |
| Ver assinatura/uso (`GET /subscription`) | ✅ | ✅ | ✅ | ❌ |
| Checkout / trocar plano / cancelar | ✅ | ❌ | ❌ | ❌ |
| Webhook de billing | (sistema, assinado) | — | — | ✅ (validado por assinatura) |
| Acessar dados de **outra** organização | ❌ | ❌ | ❌ | ❌ |

> Áreas de agenda/clientes/serviços/profissionais entram nas próximas fases; suas policies seguirão este mesmo modelo (autorização por recurso + tenant).

## Garantias de isolamento (implementadas + provadas)

- **Provisionamento transacional** (`ProvisioningService`): usuário + organização + settings + membership `owner` numa transação. Papel de auto-cadastro é **sempre** owner — corrige a escalada de privilégio do sistema legado (não lê role/org de dados do cliente).
- **Um membership por (org, usuário)** (unique). Memberships de orgs distintas são isolados (teste negativo com 2 orgs).
- **Uma assinatura viva por organização** (índice parcial PostgreSQL) — impede duplicidade.
- **Chaves UUID** preservam IDs do Supabase na futura migração de dados.

## RLS como defesa adicional (planejado — Fase C)

A autorização primária é no servidor (middleware + policies + escopos por tenant). Como **defesa em profundidade**, políticas RLS por `organization_id` serão reaplicadas no PostgreSQL próprio (equivalentes ao `private.current_organization_id()` do Supabase), **sem** depender apenas delas. Os scripts legados `fix_all_rls.sql`/`fix_rls_recursion.sql` do repositório original **não** serão portados (enfraquecem o RLS — ver AUDIT §3/§7).

## Testes de isolamento (evidência)

`backend/tests/Feature/Organizations/MultiTenancyTest.php` (parte das 29 asserções verdes): provisionamento como owner, transacionalidade, isolamento entre 2 organizações, unicidade de slug.

## Pendências

- Convites/revogação de membros e proteção do "último owner ativo" (transferência segura) — próxima iteração do módulo Memberships.
- Testes negativos adicionais de IDOR/BOLA por recurso quando as áreas de agenda/clientes forem migradas.
- Isolamento em arquivos (S3/MinIO), cache, jobs e logs — a reforçar na Fase F.
