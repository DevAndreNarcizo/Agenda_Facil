# Análise completa — Agenda Fácil

**Data da análise:** 15/08/2026
**Commit analisado:** `30f7d34995329219d1eb41ac3cc7d31cc0da6931`
**Branch:** `main`
**Repositório:** `DevAndreNarcizo/Agenda_Facil`
**Responsável pela análise:** André Narcizo

## 1. Resumo executivo

O Agenda Fácil tem uma boa base visual e um recorte de produto promissor: agenda para pequenos negócios, portal do cliente, gestão de profissionais, CRM, WhatsApp e assinatura. Entretanto, o projeto ainda não está pronto para operação comercial ou exposição pública sem uma rodada de correções estruturais.

Os maiores riscos não são apenas de qualidade de código. Há problemas que podem:

- quebrar o fluxo de cadastro, recuperação de senha, analytics e cobrança;
- permitir manipulação de identidade no Portal do Cliente;
- provocar acesso ou alteração indevida entre organizações caso as políticas RLS atuais sejam aplicadas;
- expor endpoints de WhatsApp e cobrança a abuso;
- dificultar reproduzir o banco de dados em outro ambiente;
- impedir o deploy porque o build e o lint falham.

### Veredito

| Área | Situação | Avaliação |
|---|---|---:|
| Proposta de produto | Clara e monetizável | 7/10 |
| Interface visual | Bem trabalhada, porém incompleta | 7/10 |
| Arquitetura | Funciona como MVP, mas está acoplada | 4/10 |
| Segurança | Riscos críticos em auth, RLS, OTP e endpoints | 2/10 |
| Banco e migrações | Inconsistência entre `companies` e `organizations` | 2/10 |
| Funcionalidade principal | Agenda ainda é majoritariamente somente leitura | 4/10 |
| Testes | Não existem testes automatizados | 1/10 |
| Deploy/operabilidade | Sem CI, build quebrado e documentação divergente | 3/10 |

**Prioridade recomendada:** corrigir segurança e contrato do banco antes de adicionar novas funcionalidades.

---

## 2. Escopo e método

Foram revisados:

- estrutura do frontend React/TypeScript/Vite;
- hooks, contextos, rotas e páginas de autenticação;
- dashboard, calendário, clientes, profissionais, serviços, analytics e assinatura;
- Portal do Cliente;
- SQL, RLS, funções RPC, migrations e Edge Functions;
- serviço Node.js de WhatsApp;
- configuração de build, lint, Netlify, service worker e variáveis de ambiente;
- dependências e lockfiles;
- documentação do projeto.

Validações executadas:

```text
npm run build              FALHOU
npm run lint               FALHOU
npm audit --omit=dev       10 vulnerabilidades reportadas
```

Não foi feita conexão ao banco Supabase de produção. Portanto, as conclusões de RLS, RPC e schema são baseadas nos arquivos versionados. Antes de aplicar correções no banco, deve ser feita uma auditoria do schema real e das políticas atualmente instaladas.

---

## 3. Estado atual do repositório

O repositório local e o GitHub estão sincronizados no commit `30f7d34`. A árvore de trabalho estava limpa no início da análise.

O projeto possui aproximadamente **8.960 linhas** em TypeScript, TSX, JavaScript e SQL. Não há testes, configuração de Vitest, Jest, Playwright, Cypress ou pipeline de CI versionada.

Scripts disponíveis:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

### Problema de rastreamento do `.env`

O arquivo `.env` está versionado:

```text
git ls-files .env
```

Além disso, existem commits históricos que contêm o arquivo. Mesmo que os valores atuais sejam chaves públicas do Supabase, manter `.env` no histórico cria risco de futuros secrets serem publicados e dificulta uma resposta a incidente.

**Correção:** remover o arquivo do índice, manter somente `.env.example`, revisar o histórico e rotacionar qualquer credencial que tenha sido secret em algum momento.

---

## 4. Bloqueadores críticos

### AG-001 — O build está quebrado

**Severidade:** P0 — bloqueador de deploy
**Evidências:** `src/hooks/use-employees.ts:81-97`, `src/layouts/DashboardLayout.tsx:115`, `src/pages/dashboard/SettingsPage.tsx:55`, `src/pages/dashboard/components/EmployeeForm.tsx:1`

Falhas atuais:

- inserções em `profiles` inferem `never`, indicando cliente Supabase sem tipos gerados;
- `refreshProfile` é declarado e não utilizado;
- `err` é declarado e não utilizado;
- `UseFormReturn` foi importado como valor, mas deveria ser importado como tipo.

**Impacto:** o deploy configurado no Netlify falha antes de gerar o bundle.

**Correção:** gerar tipos do banco, tipar o `createClient<Database>`, corrigir imports type-only, remover variáveis mortas e adicionar o build ao CI.

---

### AG-002 — O arquivo `.env` está versionado

**Severidade:** P0 — segurança e governança
**Evidências:** `.env` aparece em `git ls-files` e no histórico Git.

**Correção imediata:**

1. verificar se o histórico contém qualquer secret além de chaves públicas;
2. rotacionar imediatamente credenciais que forem secret;
3. remover `.env` do repositório e do histórico com `git filter-repo` ou procedimento equivalente;
4. manter `.env.example` sem valores reais;
5. adicionar secret scanning no CI.

Não publicar nenhum valor do arquivo no README, issues, logs ou documento de análise.

---

### AG-003 — O Portal do Cliente não possui uma sessão confiável

**Severidade:** P0 — autorização/BOLA
**Evidências:** `src/pages/portal/PortalLogin.tsx:100-104`, `src/pages/portal/PortalLayout.tsx:7-20`, `src/pages/portal/PortalHome.tsx:30-37`, `src/pages/portal/PortalBooking.tsx:30-88`

Após o OTP, o sistema grava `customer_id`, `customer_name` e `organization_id` diretamente no `localStorage`. Esses valores podem ser alterados pelo próprio usuário no navegador. As páginas e RPCs usam esses IDs como identidade.

**Impacto:** se as RPCs ou RLS não validarem rigorosamente o vínculo, um cliente pode consultar agendamentos de outro cliente, listar serviços de outra organização ou criar agendamentos em nome de terceiros.

**Correção recomendada:**

- substituir o `localStorage` por uma sessão de portal curta e assinada;
- preferencialmente usar Supabase Auth com OTP/magic link e sessão JWT;
- se for necessário manter autenticação customizada, criar uma Edge Function que valide o OTP e emita um token de portal com `customer_id`, `organization_id`, expiração e nonce;
- fazer todas as RPCs derivarem a identidade do token, nunca de um ID livre enviado pelo cliente;
- aplicar RLS específica para o portal;
- invalidar sessões após logout, troca de telefone ou expiração.

---

### AG-004 — As políticas RLS permitem caminhos de escalação e alteração indevida

**Severidade:** P0 — isolamento multi-tenant
**Evidências:** `supabase/fix_all_rls.sql:95-137`

Os principais problemas do script são:

- `profiles_update` permite que o próprio usuário atualize sua linha sem limitar quais colunas pode modificar;
- `profiles_update` permite atualizar perfis da mesma organização sem exigir que o autor seja proprietário/admin;
- a política de `profiles_update` aceita situações em que `organization_id IS NULL` sem controle de papel;
- `profiles_insert` aceita combinações amplas de `id` e `organization_id`;
- `profiles_delete` não restringe explicitamente a operação ao proprietário/admin;
- `organizations_select` permite selecionar qualquer organização quando o usuário ainda não possui organização;
- updates de `organizations` não estão limitados por coluna nem por papel;
- policies de `services`, `customers` e `appointments` têm `USING`, mas não possuem `WITH CHECK` nos updates;
- `TO authenticated` ou autenticação por si só não garante autorização por organização.

**Impacto:** um usuário autenticado pode tentar alterar papel, organização, plano, slug ou dados de outros membros. A aplicação não pode confiar somente nos controles da interface.

**Correção:**

- criar funções seguras como `is_org_owner()` e `is_org_admin()` com `SECURITY DEFINER`, `search_path` fixo e grants mínimos;
- separar policies por operação e por papel;
- adicionar `WITH CHECK` a todos os updates;
- impedir alteração direta de `role`, `organization_id`, `plan_name`, IDs do Stripe e campos de auditoria pelo frontend;
- expor mutações privilegiadas somente por RPC/Edge Function;
- testar cada tabela com usuários de organizações diferentes e usuários sem organização;
- revogar execução pública de funções sensíveis.

---

### AG-005 — OTP retorna o próprio código para o frontend

**Severidade:** P0 — autenticação
**Evidências:** `src/database/01_otp_system.sql:34-36`, `src/database/05_update_otp_with_whatsapp.sql:45-57`, `src/pages/portal/PortalLogin.tsx:44-68`

O RPC retorna `simulated_code`. Se o WhatsApp falhar, o frontend ainda exibe o código em um toast de desenvolvimento. A função SQL também não apresenta rate limit, contador de tentativas, bloqueio progressivo ou limpeza controlada.

**Impacto:** qualquer ambiente configurado com essa função pode permitir login sem posse real do telefone. Também há risco de abuso para gerar códigos e disparar mensagens.

**Correção:**

- remover `simulated_code` de produção;
- gerar e enviar o OTP exclusivamente no servidor;
- armazenar somente hash do código, com expiração curta;
- limitar requisições por telefone, IP e organização;
- limitar tentativas de verificação;
- normalizar telefone em E.164;
- consumir o código atomicamente;
- emitir sessão confiável somente após a verificação.

---

### AG-006 — Recuperação de senha não conclui a troca da senha

**Severidade:** P0 — funcionalidade e segurança
**Evidências:** `src/database/03_password_recovery.sql:52-58`, `src/database/03_password_recovery.sql:90-123`, `src/pages/auth/ForgotPassword.tsx:27-35`, `src/pages/auth/ResetPassword.tsx:71-89`

O fluxo atual retorna `simulated_token` e `simulated_link`. A função `complete_password_reset` apenas marca o token como usado e retorna uma mensagem; ela não atualiza a senha. A tela de reset também não executa `supabase.auth.updateUser()` depois da validação.

**Correção recomendada:** usar o fluxo oficial do Supabase:

1. `supabase.auth.resetPasswordForEmail()`;
2. redirecionamento para uma URL de recuperação registrada;
3. recuperação da sessão no callback;
4. `supabase.auth.updateUser({ password })`;
5. expiração e revogação da sessão anterior;
6. mensagens genéricas para evitar enumeração de contas.

---

### AG-007 — Contrato de banco divergente: `companies` versus `organizations`

**Severidade:** P0 — integridade do produto
**Evidências:** `schema.sql`, `schema_update.sql`, `src/database/01_otp_system.sql`, `src/database/02_prevent_double_booking.sql`, `src/database/04_audit_logs.sql`, `src/database/07_analytics_functions.sql`, `supabase/migrations/20260321_add_subscription_fields.sql`

O frontend atual usa `organizations` e `organization_id`, enquanto vários SQLs antigos usam `companies` e `company_id`.

Exemplos:

- `verify_otp()` retorna `customer_record.company_id`, mas o frontend espera `customer.organization_id`;
- constraints de double booking usam `company_id`;
- auditoria usa `company_id` e triggers leem `OLD.company_id`/`NEW.company_id`;
- analytics recebem parâmetro `company_id`, enquanto `AnalyticsPage` chama as RPCs com `organization_id`;
- a migration de assinatura altera `public.companies`, enquanto o checkout e o webhook atualizam `organizations`.

**Impacto:** funções podem falhar em produção, triggers podem quebrar inserções, analytics podem retornar erro ou dados incorretos e cobrança pode não ativar o plano.

**Correção:** escolher `organizations` como modelo canônico, criar uma migration única e versionada, renomear colunas/funções, remover SQL legado e gerar os tipos a partir do banco real. A partir daí, nenhuma página deve executar SQL manual fora do diretório oficial de migrations.

---

### AG-008 — Checkout Stripe não valida identidade nem plano no servidor

**Severidade:** P0 — cobrança
**Evidências:** `supabase/functions/create-checkout/index.ts:13-50`, `src/pages/dashboard/SubscriptionPage.tsx:11-49`, `supabase/functions/stripe-webhook/index.ts:36-60`

Problemas:

- a Edge Function aceita `priceId`, `customerEmail` e `metadata` enviados pelo cliente;
- não valida o JWT nem confirma que o usuário pertence à organização informada;
- os IDs dos planos ainda são placeholders;
- o webhook procura `companyId` ou `organizationId`, mas o checkout envia `organization_id`;
- o webhook aceita eventos repetidos sem uma tabela de idempotência;
- o CORS do checkout é `*`;
- erros internos do Stripe são devolvidos ao cliente.

**Correção:**

- validar o JWT no servidor;
- derivar usuário, email e organização do token, não do body;
- aceitar somente uma allowlist de Price IDs configurada em secrets;
- criar a sessão com o customer correto;
- corrigir o nome do metadata;
- registrar `event.id` processado e tornar o webhook idempotente;
- validar origem permitida;
- retornar mensagens genéricas e registrar detalhes apenas no log seguro.

---

### AG-009 — Endpoints de WhatsApp podem ser abusados

**Severidade:** P0 — abuso financeiro e reputacional
**Evidências:** `supabase/functions/send-whatsapp/index.ts:6-89`, `supabase/functions/send-reminders/index.ts:15-127`, `whatsapp-service/index.js:11-119`, `whatsapp-service/index.js:121-196`

O serviço Node expõe `/send-message` e `/send-otp` sem autenticação e com CORS aberto. A rota `/status` expõe o estado do WhatsApp e pode expor QR code. A Edge Function aceita telefone e mensagem arbitrários; a função de lembretes não valida método, assinatura de cron ou autorização.

**Impacto:** envio de spam, custo de API, banimento do número, abuso do WhatsApp e vazamento operacional.

**Correção:**

- colocar o serviço atrás de autenticação entre serviços;
- restringir CORS a origens conhecidas;
- nunca retornar QR code publicamente;
- aplicar rate limit, tamanho máximo e templates permitidos;
- permitir somente mensagens de casos de uso conhecidos;
- validar telefone e organização no backend;
- proteger o endpoint de reminders com secret de cron ou JWT de serviço;
- adicionar timeout, retry controlado, fila e dead-letter;
- registrar `message_id`, status e motivo de falha sem armazenar conteúdo sensível desnecessário.

---

## 5. Banco, migrations e multi-tenancy

### AG-010 — SQL manual fora de migrations

O projeto possui SQL em `schema.sql`, `schema_update.sql`, `src/database/` e `supabase/`, com instruções para copiar e colar no SQL Editor. Isso impede saber exatamente qual versão do banco está aplicada.

**Melhoria:** migrar tudo para `supabase/migrations/`, numerar as alterações, usar `supabase db diff`/`db pull` com revisão e documentar o estado inicial. O deploy deve falhar quando a migration não estiver aplicada.

### AG-011 — Funções `SECURITY DEFINER` sem hardening uniforme

Várias funções SQL usam `SECURITY DEFINER`. Algumas não definem `search_path`, não restringem `EXECUTE` ou aceitam IDs fornecidos pelo cliente.

**Melhoria:** usar `SET search_path = ''` ou `public` conforme a função, qualificar objetos, revogar `EXECUTE FROM PUBLIC`, conceder somente a roles necessárias e validar `auth.uid()` dentro de cada função.

### AG-012 — Auditoria inconsistente e potencialmente perigosa

`src/database/04_audit_logs.sql` referencia campos antigos e captura `row_to_json(OLD/NEW)` sem política de retenção ou mascaramento. Dados de telefone, email, notas e outros dados pessoais podem ser armazenados integralmente.

**Melhoria:** alinhar a coluna de organização, registrar somente campos necessários, mascarar dados pessoais, adicionar `request_id`, origem e ator derivado de `auth.uid()`, restringir leitura a owners/admins e definir retenção.

### AG-013 — Policies não substituem filtros de aplicação

Mutations como `update`, `delete` e `select` usam apenas `.eq("id", id)` em vários hooks e páginas. O RLS deve bloquear o acesso cruzado, mas adicionar também `.eq("organization_id", profile.organization_id)` melhora defesa em profundidade e facilita detectar dados inconsistentes.

Arquivos principais: `src/hooks/use-appointments.ts`, `src/hooks/use-customers.ts`, `src/hooks/use-employees.ts`, `src/pages/dashboard/ServicesPage.tsx`.

### AG-014 — Índices e paginação precisam ser projetados junto com o banco

Clientes e agendamentos são carregados integralmente no navegador. O hook de clientes ainda busca todos os agendamentos relacionados para calcular estatísticas.

**Melhoria:** paginação server-side, busca por texto, filtros por intervalo, índices compostos por organização/data/status e RPCs agregadas para estatísticas. O tamanho máximo de página deve ser limitado no servidor.

---

## 6. Autenticação e autorização do dashboard

### AG-015 — Controle de papel somente visual

`ProtectedRoute` aceita `allowedRoles`, mas nenhuma rota do dashboard informa papéis permitidos. A interface disponibiliza gestão de equipe, configurações e assinatura sem bloquear colaboradores.

**Melhoria:** definir matriz de permissões:

| Recurso | Owner | Admin | Staff/Employee |
|---|---:|---:|---:|
| Dashboard | sim | sim | sim |
| Agenda | sim | sim | conforme escopo |
| Clientes | sim | sim | conforme escopo |
| Serviços | sim | sim | não ou limitado |
| Profissionais | sim | sim | não |
| Tema/organização | sim | limitado | não |
| Assinatura | sim | não | não |

O backend deve ser a autoridade; o frontend apenas esconde ações.

### AG-016 — Race condition no carregamento do perfil

Em `src/context/AuthContext.tsx:55-63`, `loading` é marcado como `false` antes de `fetchProfile()` terminar quando ocorre mudança de sessão. Isso pode renderizar o dashboard com `profile` nulo e disparar redirecionamento indevido para onboarding.

**Melhoria:** controlar estado `authReady` e `profileLoading` separadamente, cancelar requests obsoletas e só liberar as rotas depois de carregar o perfil.

### AG-017 — Criação de profissional via `signUp` no navegador

`src/hooks/use-employees.ts:50-103` cria uma nova conta Auth com o cliente público e tenta atualizar/inserir o perfil em seguida.

Problemas:

- fluxo não é transacional;
- pode deixar usuário Auth órfão;
- depende de políticas frágeis;
- expõe senha inicial ao navegador do administrador;
- não há convite ou definição de primeiro acesso;
- o cliente está incorretamente chamado de `adminClient`, embora use chave pública.

**Melhoria:** criar Edge Function de convite, validar owner/admin, usar `inviteUserByEmail` em ambiente seguro, criar membership de forma atômica e exigir definição de senha pelo profissional.

---

## 7. Fluxos de negócio quebrados ou incompletos

### AG-018 — Onboarding descarta a maior parte dos dados preenchidos

`src/pages/onboarding/OnboardingPage.tsx:15-35` coleta especialidade, Instagram, biografia, endereço e horários. Porém `handleFinishOnboarding()` só persiste organização, perfil básico e primeiro serviço.

Não são persistidos:

- `specialty`;
- `instagram`;
- `bio`;
- `cep`;
- `address`;
- `city`;
- `state`;
- `number`;
- `schedule`.

**Correção:** definir onde cada campo vive, persistir tudo por uma RPC transacional e permitir retomar o onboarding sem perder dados.

### AG-019 — Onboarding não é idempotente

Se o usuário clicar novamente, atualizar a página ou falhar após criar a organização, uma nova organização pode ser criada. Falhas intermediárias não executam rollback.

**Correção:** RPC `complete_onboarding()` com transação, unique constraint para slug, upsert controlado e estado de onboarding.

### AG-020 — Calendário é somente leitura

`src/pages/dashboard/CalendarPage.tsx` renderiza eventos, mas não usa `onSelectEvent`, `onSelectSlot` ou os métodos de mutação disponíveis em `useAppointments()`.

O produto é uma agenda, porém o gestor não consegue criar, editar, cancelar ou confirmar um agendamento pelo dashboard.

**Correção:** criar fluxo completo de agenda com:

- criação manual;
- seleção de cliente, serviço e profissional;
- validação de horário de funcionamento;
- confirmação, conclusão e cancelamento;
- motivo de cancelamento;
- bloqueios e intervalos;
- atualização otimista com rollback;
- proteção contra concorrência no banco.

### AG-021 — Portal agenda sem profissional, expediente ou timezone explícitos

`src/pages/portal/PortalBooking.tsx:49-88` cria o horário a partir de `new Date(`${date}T${time}`)` e não envia profissional. Também depende de RPCs que não estão versionadas no projeto.

**Riscos:** horário fora do expediente, conversão incorreta de fuso, conflito entre profissionais e inconsistência entre disponibilidade exibida e disponibilidade real.

**Correção:** armazenar timezone da organização, usar instantes UTC no banco, manter horário local na interface, consultar slots reais no backend e fazer o insert com constraint/transaction.

### AG-022 — Analytics possui contrato provavelmente incompatível

`src/pages/dashboard/AnalyticsPage.tsx:44-47` chama todas as RPCs com `organization_id`, mas `src/database/07_analytics_functions.sql` define parâmetro `company_id`.

Além disso, as funções são `SECURITY DEFINER` e aceitam um identificador de organização fornecido pelo cliente sem mostrar uma validação de membership.

**Correção:** remover o parâmetro externo quando possível e derivar a organização do usuário autenticado; caso contrário, validar membership dentro da função e alinhar nomes/tipos com o frontend.

### AG-023 — Cobrança ainda é demonstrativa

Os planos usam IDs como `price_starter_placeholder`, `price_pro_placeholder` e `price_clinica_placeholder`. A tela promete recursos que não estão implementados ou não estão ligados ao controle de limites.

**Correção:** configurar Price IDs reais via secrets, criar tabela de planos/entitlements, aplicar limites no backend e exibir status real de trial, ativo, inadimplente e cancelado.

---

## 8. Frontend, arquitetura e manutenibilidade

### AG-024 — Acesso direto ao Supabase espalhado pela UI

As páginas `SettingsPage`, `ServicesPage`, `ThemeCustomization`, `PortalBooking`, `PortalLogin` e hooks acessam Supabase diretamente. Isso mistura apresentação, validação, autorização, transformação e persistência.

**Arquitetura recomendada:**

```text
pages/components
        ↓
hooks/use-cases
        ↓
repositories/adapters
        ↓
Supabase RPC/Data API/Edge Functions
```

Criar módulos por domínio:

```text
src/features/auth
src/features/appointments
src/features/customers
src/features/services
src/features/team
src/features/billing
src/features/portal
src/shared
```

### AG-025 — Tipos de domínio duplicados e incompletos

`Appointment`, `Customer`, `Employee` e `Service` são definidos localmente em múltiplos arquivos. O cliente Supabase não possui tipos gerados.

**Melhoria:** gerar `database.types.ts`, criar DTOs de entrada/saída e usar `zod` para validar respostas críticas. Nunca usar `Partial<Appointment>` como payload de update, pois permite incluir campos que não deveriam ser editáveis.

### AG-026 — Validação insuficiente fora do login/cadastro

Clientes, serviços, configurações, onboarding e portal usam validações manuais mínimas. Exemplos:

- preço pode ser negativo ou não finito;
- duração pode ser zero ou inválida;
- telefone não é validado em formato canônico;
- URL do logo não é validada;
- slug não é validado novamente no settings;
- horário final pode ser anterior ao inicial;
- nomes e descrições não possuem limites consistentes.

**Melhoria:** schemas Zod compartilhados, validação de limite no frontend e constraints equivalentes no banco.

### AG-027 — Erros são ocultados ou tratados como dados vazios

`useCustomers()` retorna lista vazia quando interpreta determinados erros como tabela inexistente. Isso transforma indisponibilidade ou migration ausente em “nenhum cliente”. O tema também silencia falhas.

**Melhoria:** separar estado `empty` de `error`, exibir retry, registrar contexto técnico e não mascarar erro de schema.

### AG-028 — Consultas e estado podem gerar custo e inconsistência

- não há paginação de agendamentos, clientes ou profissionais;
- várias telas fazem refetch manual além de React Query;
- realtime invalida a query inteira após qualquer mudança;
- não há cancelamento de requests nem tratamento de concorrência;
- as estatísticas usam datas locais e `toISOString()` em pontos diferentes;
- `refetchOnWindowFocus` está desabilitado globalmente, podendo deixar dados desatualizados.

**Melhoria:** padronizar React Query, chaves, invalidação por recurso, paginação e política de timezone.

### AG-029 — Componentes grandes e responsabilidades misturadas

Arquivos como `AnalyticsPage.tsx`, `DashboardLayout.tsx`, `EmployeesPage.tsx` e `SubscriptionPage.tsx` concentram layout, queries, regras e mutações.

**Melhoria:** separar container/presentation, componentes de estado, schemas, actions e tabelas. O layout não deve decidir regras de autorização.

---

## 9. Bugs e lacunas de interface

### AG-030 — Ações visuais sem implementação

Foram encontrados elementos que parecem funcionar, mas não têm comportamento:

- busca de serviços em `src/pages/dashboard/ServicesPage.tsx:153-160` não possui estado nem filtro;
- botão “Criar meu primeiro Combo” não possui handler;
- botão “Otimizar Escala” em analytics não possui handler;
- botão de notificações em `DashboardLayout.tsx:184-187` não possui ação;
- links de Termos, Privacidade, Políticas, Ajuda e Suporte usam `#` ou rotas provisórias;
- `Ver Meu Portal` aponta para `/p/{slug}`, mas a aplicação não possui rota `/p/:slug`;
- o FAB global de “+” leva sempre para profissionais, em vez de criar agendamento/contexto da tela.

### AG-031 — Navegação força reload completo

`DashboardLayout.tsx:94-98` usa `window.location.href` para navegar dentro da SPA. Isso perde estado, reinicializa queries e torna a navegação mais lenta.

**Correção:** usar `Link` ou `useNavigate()`.

### AG-032 — Rotas raiz duplicadas

`src/App.tsx:36` redireciona `/` para `/login` e `src/App.tsx:92` declara outra rota `/` para `/dashboard`. Manter apenas uma definição, com decisão baseada na sessão se necessário.

### AG-033 — Acessibilidade incompleta

Melhorias necessárias:

- `html lang="en"` deve ser `pt-BR` ou ser atualizado dinamicamente;
- botões com ícones precisam de `aria-label` consistente;
- elementos clicáveis como cards e `div` devem ser buttons/links reais;
- estados de erro precisam de `role="alert"` e associação com campos;
- foco deve ser preservado após fechar dialogs;
- revisar contraste dos tokens de tema customizáveis;
- adicionar navegação por teclado ao calendário e ao portal;
- respeitar `prefers-reduced-motion`.

### AG-034 — Dependências externas desnecessárias ou sem controle

Há fontes e texturas carregadas de terceiros, avatar via DiceBear e imagens remotas de logo. Isso aumenta dependência de disponibilidade externa e pode transmitir dados de clientes no parâmetro `seed` do avatar.

**Melhoria:** hospedar assets essenciais, remover nome de cliente de URLs externas, usar CSP e validar URLs de imagens.

---

## 10. Dependências e supply chain

O `npm audit --omit=dev` reportou:

```text
1 moderada
9 altas
0 críticas
10 total
```

Entre os pacotes/runtime envolvidos estão:

- `react-router-dom@7.9.6` / `react-router@7.9.6`;
- `lodash` e `lodash-es` via `react-big-calendar`;
- `ws` via `@supabase/realtime-js`;
- outras vulnerabilidades em dependências de tooling como ESLint.

**Plano:** atualizar em branch separada, revisar changelogs, rodar build/lint/testes e verificar regressões do calendário e realtime. Não executar `npm audit fix --force` diretamente em `main`.

Também é recomendado:

- usar Dependabot/Renovate;
- fixar versões críticas quando necessário;
- manter lockfiles do frontend e WhatsApp;
- executar `npm ci` no CI para instalação reprodutível;
- verificar dependências do serviço WhatsApp separadamente.

---

## 11. Testes necessários

Atualmente não há testes automatizados. O mínimo para o produto deveria ser:

### Unitários

- normalização de telefone;
- geração/validação de slug;
- cálculo de duração e horário final;
- timezone e formatação;
- métricas do dashboard;
- regras de limite por plano;
- validação de payloads Zod.

### Integração

- RLS por organização;
- criação de cliente/serviço/agendamento;
- atualização sem alteração de `organization_id`;
- conflito de horários concorrentes;
- onboarding idempotente;
- criação e cancelamento de assinatura;
- RPCs do portal.

### E2E

Fluxos mínimos:

1. cadastro e onboarding completo;
2. login e logout;
3. recuperação real de senha;
4. criar serviço;
5. criar cliente;
6. criar profissional por convite;
7. criar e confirmar agendamento;
8. portal OTP e novo agendamento;
9. isolamento entre duas organizações;
10. checkout e retorno do webhook.

### Segurança automatizada

- testes de autorização com IDs adulterados;
- tentativa de alterar papel/organização;
- rate limit de OTP;
- chamada sem JWT às Edge Functions;
- webhook com assinatura inválida;
- payloads grandes e campos inesperados.

---

## 12. Roadmap recomendado

### Fase 0 — Bloqueio de segurança

- retirar `.env` do versionamento e revisar histórico;
- revisar/rotacionar credenciais;
- desabilitar endpoints públicos de WhatsApp e cobrança até validar auth;
- auditar RLS no banco real;
- suspender uso comercial do Portal do Cliente até haver sessão confiável;
- substituir OTP e recuperação de senha simulados.

### Fase 1 — Fundação técnica

- escolher `organizations/organization_id` como padrão;
- consolidar migrations;
- gerar tipos Supabase;
- corrigir build e lint;
- criar CI com `npm ci`, lint, typecheck, testes e build;
- criar camada de repositórios/use cases;
- padronizar erros, logs e timezone.

### Fase 2 — Núcleo do produto

- tornar onboarding transacional e completo;
- implementar criação/edição/cancelamento de agendamentos no dashboard;
- implementar expediente, pausas, bloqueios e disponibilidade real;
- garantir constraint de double booking por organização/profissional;
- implementar portal autenticado;
- adicionar paginação e filtros server-side.

### Fase 3 — Monetização confiável

- configurar Price IDs reais;
- validar checkout no servidor;
- corrigir metadata do webhook;
- criar idempotência e reconciliação de assinaturas;
- aplicar entitlements por plano;
- registrar métricas de trial, ativação, churn e uso.

### Fase 4 — Retenção e diferenciação

- lembretes confiáveis via fila;
- confirmação/cancelamento por WhatsApp;
- lista de espera;
- combos e campanhas;
- relatórios financeiros corretos;
- página pública por slug;
- onboarding de importação de clientes;
- observabilidade e suporte.

---

## 13. Critérios para considerar o MVP pronto

O Agenda Fácil só deveria ser tratado como pronto para os primeiros clientes pagantes quando:

- `npm run build` passar;
- `npm run lint` passar;
- houver pelo menos os testes E2E dos fluxos críticos;
- duas organizações não conseguirem ler ou alterar dados uma da outra;
- nenhum usuário conseguir mudar o próprio papel ou organização pelo frontend;
- OTP não for retornado ao cliente;
- recuperação de senha realmente alterar a senha;
- onboarding persistir todos os dados declarados;
- o calendário permitir criar e gerenciar agendamentos;
- checkout e webhook forem validados e idempotentes;
- migrations reproduzirem o banco do zero;
- `.env` e secrets não estiverem no histórico público;
- endpoints de WhatsApp estiverem autenticados e limitados;
- houver logs de erro e alertas para falhas de pagamento, mensagens e banco.

---

## 14. Lista consolidada por prioridade

### P0 — fazer antes de novas features

1. Remover `.env` do histórico e rotacionar secrets se necessário.
2. Corrigir RLS e testar isolamento multi-tenant.
3. Substituir sessão do portal baseada em `localStorage`.
4. Remover código OTP simulado e aplicar rate limit.
5. Corrigir recuperação de senha.
6. Unificar `companies`/`organizations` e todas as funções SQL.
7. Proteger checkout, webhook, reminders e WhatsApp.
8. Corrigir o build.

### P1 — fazer antes do primeiro cliente pagante

9. Tornar onboarding transacional e persistir todos os campos.
10. Implementar RBAC real no backend.
11. Implementar criação e gestão de agendamentos no dashboard.
12. Corrigir analytics e constraints de disponibilidade.
13. Trocar criação de funcionários por convite seguro.
14. Adicionar validação compartilhada e filtros/paginação server-side.
15. Criar testes de autorização, integração e E2E.
16. Corrigir lint e vulnerabilidades de dependências.

### P2 — crescimento e acabamento

17. Implementar ações visuais hoje sem handler.
18. Criar página pública por slug.
19. Melhorar acessibilidade, estados de erro e navegação.
20. Adicionar observabilidade, métricas de produto e suporte.
21. Remover SQL legado e atualizar documentação de deploy.
22. Hospedar assets e reduzir dependências externas.

---

## Conclusão

O projeto merece continuidade porque já possui uma proposta comercial clara e uma interface que pode gerar boa percepção de valor. A próxima etapa, porém, não deve ser adicionar mais telas. O maior retorno virá de transformar o MVP visual em um produto confiável: banco consistente, autorização correta, agenda realmente operacional, cobrança segura e testes dos fluxos críticos.

Depois da Fase 0 e da Fase 1, o projeto estará em condição muito melhor para validar clientes reais sem colocar dados, dinheiro ou reputação em risco.

---

## 15. Reanálise pós-correções locais — 15/08/2026

### Resultado da validação

| Verificação | Resultado |
|---|---|
| `npm run lint` | aprovado |
| `npm test` | aprovado — 2 testes unitários |
| `npm run build` | aprovado |
| `npm audit` | 0 vulnerabilidades |
| Banco/Supabase remoto de teste | verificado via MCP; migrations e validação transacional de RLS aprovadas |

### Correções aplicadas

| Item original | Situação | Evidência |
|---|---|---|
| AG-001 build quebrado | **corrigido** | tipagem explícita do cliente em `src/lib/database.types.ts`; build aprovado |
| AG-002 `.env` rastreado | **corrigido localmente** | removido do índice Git; arquivo permanece local e `.env.example` continua público |
| AG-005 OTP exposto no cliente | **mitigado** | interface não exibe nem encaminha `simulated_code` para endpoint público |
| AG-006 reset de senha falso | **corrigido no frontend** | fluxo usa `resetPasswordForEmail` e `updateUser` do Supabase Auth |
| AG-008 checkout sem autorização | **corrigido no código** | Edge Function valida JWT, owner, plano permitido e Price ID somente no servidor |
| AG-015 RBAC somente visual | **mitigado e validado em teste** | rotas sensíveis possuem guard de papel; matriz RLS de duas organizações aprovada |
| AG-016 corrida de perfil | **corrigido** | `AuthProvider` só libera a interface após sincronizar sessão e perfil |
| AG-017 `signUp` no navegador | **corrigido no código** | cadastro migrou para `create-employee` com Service Role isolado na Edge Function |
| AG-025 tipos Supabase ausentes | **corrigido** | contrato oficial regenerado diretamente do banco remoto pelo MCP |
| AG-027/AG-032 | **corrigidos** | rota raiz duplicada removida; guards, mensagens e falhas de sessão endurecidos |
| AG-031 | **corrigido** | navegação interna não recarrega a página inteira |
| AG-034 headers | **mitigado** | CSP, HSTS e Permissions-Policy adicionados à Netlify |
| AG-010/AG-011/AG-013/AG-014 | **aplicados e validados no ambiente de teste** | migration canônica cria ledger de webhook, índices, RLS e funções com `search_path` fixado |
| AG-016 testes/CI | **baseline criado** | Vitest e workflow GitHub Actions adicionados |
| supply chain | **corrigido no lockfile** | audit completo sem vulnerabilidades no momento da análise |

### Riscos que continuam bloqueadores de produção

1. **Portal do Cliente (AG-003/AG-005/AG-021)**: ainda usa `localStorage` como sessão e RPCs SQL legados. A interface não vaza o OTP, mas a sessão não é uma credencial confiável. Não publicar este fluxo antes da SPEC-002.
2. **Produção ainda não validada**: as migrations canônicas e a matriz RLS foram aprovadas apenas no projeto remoto de teste. O rollout produtivo exige backup, staging, janela de mudança e nova execução dos testes.
3. **SQL legado**: `schema.sql`, `src/database/` e `supabase/fix_*.sql` preservam referências a `companies/company_id`; devem ser arquivados após inventário do banco e nunca executados como fonte de verdade.
4. **WhatsApp e lembretes**: `send-whatsapp`, `send-reminders` e `whatsapp-service` ainda precisam ser substituídos pelo boundary interno da SPEC-005. Não exponha o endpoint de envio ao browser.
5. **Onboarding e agenda**: continuam incompletos e precisam das SPEC-003 e SPEC-004 antes de clientes pagantes.
6. **Histórico Git**: remover `.env` do índice não elimina versões antigas. Rotacione valores se o repositório já foi compartilhado e reescreva histórico apenas com aprovação explícita e plano de comunicação.

### Ordem recomendada de execução

1. Repetir ADR-001 e a matriz da SPEC-001 em staging/produção controlada, com backup e monitoramento.
2. Implementar SPEC-002 antes de disponibilizar o Portal do Cliente.
3. Implementar SPEC-003 e SPEC-004 para tornar onboarding e agenda comercialmente utilizáveis.
4. Aplicar SPEC-005 e ADR-004, configurar secrets e deploy das Edge Functions.
5. Expandir a suíte de testes e liberar o primeiro piloto somente após os critérios de aceite das SPECs.

### Atualização remota via Supabase MCP — 15/08/2026

O projeto remoto `AgendaFácil` foi redefinido com autorização do responsável: dados de teste e usuários de Auth foram removidos. Foram aplicadas as migrations remotas `reset_test_database`, `canonical_organizations_security` e `move_rls_helper_to_private_schema`.

Resultado verificado: `auth.users`, `organizations`, `profiles` e `webhook_events` estão vazios; RLS está ativo nas tabelas públicas; Security Advisor não reporta alertas. Foram publicadas as Edge Functions `create-checkout`, `create-employee`, `stripe-webhook`, `send-whatsapp` e `send-reminders`.

Ainda é obrigatório cadastrar os secrets de Stripe, WhatsApp, cron e `APP_URL` no painel do Supabase antes de usar cobrança ou mensageria. A proteção de senha vazada deve ser avaliada junto a um plano Pro ou superior, pois não está disponível no plano Free. Nenhum secret foi criado ou exposto nesta execução.


### Progresso da SPEC-001 — 15/08/2026

Foram gerados os tipos oficiais do banco em `src/lib/database.types.ts`; o Portal Login passou a validar explicitamente os retornos JSON das RPCs de OTP antes de consumi-los. A migration `20260815_000002_optimize_rls_policies.sql` também elimina o índice duplicado de agendamentos e evita a reavaliação por linha de `auth.uid()` nas policies de `profiles`.

O script transacional `supabase/tests/rls-isolation.sql` foi executado com sucesso no projeto remoto de teste, sem persistir fixtures: confirmou isolamento de leitura para owner/admin/employee, bloqueou inserção entre organizações e bloqueou escalação de papel. O Security Advisor segue sem alertas. Os avisos restantes do Performance Advisor são exclusivamente de índices sem uso, esperados enquanto o banco não recebe carga real; nenhum índice deve ser removido antes de telemetria de uso.

A proteção contra senhas vazadas foi verificada no painel do Supabase, mas está indisponível no plano Free. Não houve upgrade nem mudança de plano; isso requer decisão comercial específica antes de produção.
