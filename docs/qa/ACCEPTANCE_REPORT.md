# Relatório de aceite — migração Agenda Fácil

Data local: 25/10/2026. Branch `migration/saas-angular-laravel`, baseline `1f99af4`. **Vertical operacional local validada; produto ainda não homologado para piloto comercial.** React preservado. Nenhum commit, push, merge, deploy, dado real ou serviço remoto de produto foi alterado.

## Gates executados

| Comando/escopo | Exit | Resultado comprovado |
|---|---:|---|
| `npm ci`, `npm test` na raiz | 0 | Instalação aprovada; 10 arquivos, 31 testes |
| `npm run lint`, `npm run build` na raiz | 0 | ESLint, TypeScript e Vite aprovados |
| `npm audit --omit=dev --audit-level=high` na raiz | 0 | Zero vulnerabilidades de produção |
| `npm audit` completo na raiz | 1 | Três moderadas na cadeia Tailwind/PostCSS de desenvolvimento |
| Deno shared integrations | 0 | Quatro testes |
| `cd apps/api && php artisan test` | 0 | **72 testes, 499 assertions**, PostgreSQL 18.6 |
| Notifications isolados | 0 | 13 testes, 87 assertions |
| `vendor/bin/pint --test` | 0 | Formatação PHP aprovada |
| Composer validate/platform/audit | 0 | Manifest e plataforma aprovados; zero advisories |
| `cd apps/web && npm test` | 0 | **14 testes, cinco arquivos** |
| `cd apps/web && npm run build` | 0 | Angular strict/templates e lazy bundles aprovados |
| `cd apps/web && npm audit` | 0 | Zero vulnerabilidades |
| `cd apps/web && npm run test:e2e` | 0 | **Dois testes, 20,2 s no Compose completo**; ciclo integrado, viewports e acessibilidade dirigida |
| `python3 scripts/migration/check-openapi.py` | 0 | Referências, parâmetros e cobertura de 57 operações |
| actionlint dos dois workflows | 0 | Sintaxe, expressões e shell aprovados localmente |
| Compose config e sintaxe dos dois scripts shell | 0 | Configuração aprovada |
| Imagem API e runtime Compose | 0 | Build, requisitos PHP, migrations e saúde da API/CSRF/web/Mailpit aprovados |
| `git diff --check` | 0 | Sem erros de whitespace no diff versionado |
| `bash scripts/migration/verify-local-restore.sh` | 0 | Dump/restore com contagens iguais em 34 tabelas; oito organizações e oito agendamentos sintéticos |

Evidências: `docs/migration/evidence/backend-final.txt`, `notifications-final.txt`, `integration-summary.json`, `restore-final.txt`, `openapi-final.txt`, `actionlint-final.txt`, `compose-{build,runtime,health,e2e}-final.*` e `apps/web/qa-evidence/frontend-{final,e2e}.txt`. O baseline e o relatório independente preservam os checks do legado. Falhas anteriores permanecem nos logs com sua revalidação; comando iniciado não foi contado como aprovado. Traces ficam ignorados pelo Git e contêm somente ambiente sintético.

## Fluxos e proteções cobertos

O E2E percorreu cadastro, onboarding inicial, serviço/profissional, slots reais da API, reserva externa, agenda, confirmação, reagendamento, bloqueio/liberação, vistas dia/semana/mês e dimensões 390/768/1440 px. Também confirmou cancelamento por segredo sem email, checkout indisponível antes da homologação, email no Mailpit, cookie HttpOnly do portal, cancelamento e logout.

O teste de slots passou a aguardar a resposta da data consultada e conferir o DOM contra o payload. Seletores foram delimitados à linha/status corretos e os instantes do reagendamento vêm da API. As verificações funcionais permaneceram ativas.

Na API foram testados dois tenants, tenant/role/preço falsificados, IDOR, revogação, último owner, CSRF 419, rate limit 429, bearer inválido, timezone e estados da agenda. Duas conexões/processos disputam o mesmo horário: uma reserva aceita e outra rejeitada 409. Cotas e workers foram disputados em processos independentes, sem consumo/envio duplicado.

Portal cobre hash, TTL, uso único, escopo de email comprovado e tenant, revogação e invalidação por mudança de email. Arquivos cobrem MIME real, tamanho, path do servidor, isolamento, ACL privada e compensações. Billing cobre catálogo versionado, trial único, checkout idempotente/incerto, duplicidade/atraso, valor/cliente divergentes, renovação, falha, regularização, suspensão, reativação, estorno, troca, cancelamento e reconciliação. Outbox cobre dedupe, leases, retry, entrega incerta, cancelamento e cotas.

O reportador de exceções PDO/QueryException registra somente SQLSTATE validado e padrão da rota, impedindo cópia de bindings/dados pessoais para o log padrão. A regressão injeta dados sentinela sintéticos e verifica que não aparecem no log. A suíte completa foi repetida após essa proteção.

**Filesystem fake não comprova S3 externo. HTTP/provider fake não comprova ciclo sandbox Asaas nem envio WhatsApp.** Os adapters externos permanecem desabilitados; nenhum cliente foi cobrado ou recebeu mensagem real.

## Definition of Done

| Critério da missão | Estado |
|---|---|
| Organização e onboarding | Aprovado no fluxo inicial; paridade do wizard legado de seis passos pendente |
| Serviços, profissionais, reserva externa e agenda | Aprovado localmente nos fluxos cobertos |
| Plano reconhecido e limites concorrentes | Aprovado localmente; política comercial ainda não aprovada |
| Cobrança sandbox e ciclos financeiros autênticos | **Não executado** |
| Isolamento entre organizações | Aprovado nos testes locais; runtime de produção/RLS adicional pendentes |
| Angular nos tamanhos principais | Overflow/capturas aprovados; acessibilidade e reflow integral pendentes |
| Builds, testes e CI | Gates locais aprovados; GitHub Actions remoto **não executado** |
| Backups restauráveis | PostgreSQL sintético aprovado; banco/storage reais **não executados** |
| Produção inalterada | Preservada; sem operação remota nesta execução |

## QA visual e pendências

Revisão independente inspecionou as três capturas headless e o código. Identidade azul/navy, tipografia, shell e ícone do tema estão preservados. A grade usa scroll interno em tablet/smartphone; isso não prova paridade integral com a grade horária React nem WCAG 2.2 AA.

Corrigidos e revalidados: nome acessível da marca no tablet, navegação atual semântica, borda dos controles com contraste mínimo calculado de 3,25:1 no claro e 4,09:1 no escuro, associação de erros/foco nos intervalos de expediente/bloqueio e indicação de rolagem mobile. O E2E também mede cores computadas contra superfícies adjacentes. Fora da prova: associação completa em outros formulários, leitor de tela, zoom de 200%, reflow de 320 px, foco em todos os dialogs/erros de rede e todos os temas/cores.

Impedem aceite comercial: primeira vinculação checkout/cliente/assinatura e ciclos Asaas autênticos; snapshot/importação Supabase e reconciliação Stripe autorizados; paridade de onboarding, memberships/convites visuais, logo e detalhes de relatórios/paginação; templates de mensagens/S3 reais; HTTPS/staging/runtime PostgreSQL; política comercial, retenção/exportação/exclusão e revisão jurídica.

A migration `400000_allow_unlimited_plan_entitlements` conserva nulabilidade no `down()`: recuperação exige versão compatível ou restore aprovado. Não foi demonstrada reversão estrita de DDL nem autorizado rollback de dados reais. As três vulnerabilidades moderadas de desenvolvimento também permanecem registradas.

Metas: 15/12/2026 para candidato condicionado aos gates e 31/01/2027 para homologação. Este relatório não autoriza publicação, faturamento ou cutover.
