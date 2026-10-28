# Status de implementação — migração SaaS

Atualizado em 25/10/2026. **Em desenvolvimento local; ainda não é candidato aprovado a piloto e não satisfaz integralmente a Definition of Done.** Branch `migration/saas-angular-laravel`, baseline `1f99af4`. Nenhum commit, push, merge, deploy, consulta de dados reais ou alteração remota foi executado.

## Entrega implementada

- Angular 22 strict/standalone/lazy em `apps/web`; React preservado. Login/cadastro/recuperação, sessão por cookie/XSRF, onboarding inicial, dashboard, clientes, serviços, profissionais, agenda, reserva pública, portal email, analytics básicos, configurações/QR e assinatura com catálogo do servidor.
- Laravel 13/PHP>=8.4 em `apps/api`, domínios separados, UUIDs e PostgreSQL 18.6. Onboarding transacional/idempotente, memberships, convites/aceite/revogação/transferência, policies e contexto de tenant de sessão. Profissionais separados de contas.
- Agenda/reserva/portal compartilham validação de disponibilidade, duração/preço do servidor, cotas, lock e exclusão GiST. Bloqueios globais/por profissional e reagendamento; cliente novo pode reservar sem cadastro prévio pelo gestor.
- Portal com link email de uso único, hash/TTL/consumo sob lock, cookie HttpOnly e revogação; sessão independente da conta do proprietário. Email e transporte apenas sintéticos no Mailpit local.
- Billing com catálogo/versões/entitlements, trial único, checkout persistido/idempotente, histórico financeiro, webhook autenticado/reconciliável, estados de renovação/falha/regularização/suspensão/reativação/estorno/troca/cancelamento e cotas concorrentes. Adapter Asaas **desabilitado e restrito a sandbox**; não há assinatura real homologada.
- Arquivos privados com metadata tenant, MIME/tamanho, download autorizado e compensações; driver S3 obrigatório em produção. Testes usam filesystem fake, sem bucket externo.
- Notifications com outbox transacional, dedupe, lease/retry, estado incerto, cancelamento e reserva única de cota. Concorrência de workers testada; canal padrão indisponível e flags fechados, sem envio remoto.
- Compose isolado e procedimentos de setup/restore; workflows de qualidade/API/Angular/E2E sintético; OpenAPI 3.1 com cobertura das 57 operações API e CSRF. ADRs 010/011 e documentação de migração, segurança/billing/operação.

## Fases e evidências

| Fase | Estado real | Gate/limitação |
|---|---|---|
| A — auditoria/backup/baseline | Baseline local concluído | AUDIT;31 testes React+4Deno no baseline;bundleGit verificado. Backup de dados Supabase/Stripe não autorizado/não executado. |
| B — fundação/auth | Implementada localmente | Angular build/unit; Laravel CSRF, auth, recuperação, cookies, onboarding testados. OAuth Google/WhatsApp não portados/homologados. |
| C — banco/multi-tenancy | Schema novo e isolamento local implementados | Dois tenants, spoofing, IDOR, último owner, FKs e concorrência testados. Importação real e RLS runtime pendentes. |
| D — funcionalidades | Vertical operacional implementada; paridade em andamento | E2E aprovado: cadastro, catálogo, reserva, confirmação, reagendamento, bloqueio/liberação, calendário dia/semana/mês, cancelamento sem email e portal. Não desativar React antes da paridade integral. |
| E — billing | Núcleo local implementado; integração comercial bloqueada | Ciclos locais com HTTP fake e concorrência real aprovados. Correlação inicial checkout/cliente/assinatura e ciclos autênticos Asaas pendentes. |
| F — segurança/QA | Testes locais aprovados; homologação parcial | 72 testes PHP/499 assertions, Pint/Composer; Angular 14 testes, build/audit e E2E de dois testes aprovados. Revisão visual independente e correções de acessibilidade revalidadas; proteção de logs SQL testada. WCAG não certificada. |
| G — operação/staging | Infra/runbooks locais; staging não executado | Compose completo ativo: API/CSRF/web/Mailpit saudáveis e E2E em containers aprovado (dois testes, 20,2 s). Restore sintético aprovado nas 34 tabelas com oito organizações e oito agendamentos. Nenhum deploy remoto. |

Resultados finais e saídas: [ACCEPTANCE_REPORT](../qa/ACCEPTANCE_REPORT.md), `docs/migration/evidence/`. Registrar nova validação antes de alterar qualquer gate para aprovado. Históricos de falha permanecem nas evidências.

## Pendências internas antes de paridade

1. Completar as diferenças da grade horária e demais detalhes contra o React. O fluxo operacional ampliado já passou no E2E; isso não equivale à paridade integral.
2. Paridade do onboarding de seis passos, gestão visual de memberships/convites e detalhes de configurações/marca (incluindo logo), relatórios/analytics e paginação de conjuntos grandes. API funcional não prova UX equivalente.
3. Implementar e homologar o adapter real de mensagens, templates e rotina operacional. A outbox local já foi migrada/testada; nenhuma promessa de lembrete WhatsApp automático até homologação.
4. Auditoria ampla de acessibilidade: teclado, foco, erros por campo, contraste em temas/marcas, zoom/reflow, leitor de tela e demais estados. Os checks de overflow não bastam para WCAG 2.2AA.
5. Completar contratos/OpenAPI conforme novos módulos e testes de cobertura; definir/testar role PostgreSQL de runtime e RLS adicional, cache/jobs multi-tenant e observabilidade operacional.

## Bloqueios externos e decisões necessárias

- Autorização específica para export/import Supabase e inventário Stripe, backup/restore real, reconciliação e redefinição de senhas. Preservar UUIDs e relacionamentos sempre que possível; não importar sessões/hashes por suposição.
- Conta/credenciais sandbox Asaas e autorização para ciclos reais, disponibilidade de meios para a empresa brasileira, primeira vinculação, retorno de evento autêntico e reconciliação; não habilitar Pix comum como débito automático.
- Catálogo/preços/limites/trial, grace period, upgrade/downgrade/pró-rata, estorno parcial, cancelamento/recontratação e política contratual aprovados. Fixtures locais não são oferta comercial.
- Provedor/templates de mensagens, SMTP/S3 reais, domínio/HTTPS/staging; política de retenção, exportação/exclusão de titular, encarregado e revisão jurídica.

Metas permanecem 15/12/2026 para candidato condicionado a todos os gates e 31/01/2027 para homologação. Nenhuma data substitui prova de prontidão.
