# Assinaturas — contrato de migração e estado comprovado

Atualizado em 25/10/2026. Vinculado à [SPEC-017](../specs/SPEC-017-migracao-saas.md) e às SPECs 001/005. O módulo Laravel está implementado e testado **localmente com PostgreSQL e respostas HTTP sintéticas**. Não houve acesso a Stripe/Asaas/Supabase remotos, cobrança, homologação sandbox nem alteração em produção. Os testes locais não aprovam o gateway para comercialização.

## Estado de entrega

| Fluxo | Implementação e limite atual |
|---|---|
| Catálogo, preço e cotas | `plans`, `plan_versions`, `plan_entitlements`; leitura autoritativa no servidor. Fixtures só em `local/testing`, identificadas como sintéticas. |
| Trial | Provisionado no onboarding; uma assinatura por organização; `trial_used_at` e prazo persistidos; repetição não troca plano nem renova prazo. Não existe endpoint de reinício. |
| Checkout | Exclusivo do owner; plano resolvido no servidor; `Idempotency-Key` obrigatória; ledger local e apenas um checkout aberto por organização. Nenhuma ativação por redirect. |
| Timeout na criação | Tentativa fica `uncertain`; nenhuma retentativa automática de criação. Exige reconciliação antes de outro checkout. Evita duplicar uma assinatura que possa ter sido criada no provedor. |
| Primeiro vínculo de assinatura/cliente | **Pendente de homologação.** Eventos de checkout/assinatura e correlação de seus IDs precisam ser validados no sandbox. Testes de pagamento usam vínculo sintético pré-provisionado. Não inferir que `checkout.externalReference` será copiada para `subscription.externalReference`. |
| Pagamento e renovação | Webhook autenticado busca cobrança atual no provedor, confere assinatura, cliente e preço, grava invoice/payment e calcula acesso. Validado somente com HTTP fake. |
| Atraso, regularização e suspensão | `OVERDUE` inicia prazo explícito de regularização; expirado, novas operações são recusadas. Pagamento posterior válido reativa. Prazo comercial ainda não aprovado. |
| Estorno, disputa e evento atrasado | Estado atual do provedor prevalece sobre o nome do evento; estorno/disputa do período corrente suspende; evento antigo não derruba período posterior já pago. |
| Troca de plano | Solicita novo preço para cobranças futuras; novo entitlement só após cobrança confirmada do próximo período. Sem pró-rata, cobrança imediata de upgrade ou crédito automático. Essas políticas exigem definição/homologação. |
| Cancelamento | Interrompe futuras cobranças no provedor; opção imediata encerra acesso, opção ao fim preserva período pago. Pagamento atrasado não reativa cancelamento. Validado somente com HTTP fake. |
| Histórico | Invoices escopadas pelo tenant da sessão; apenas owner acessa histórico financeiro. IDs e registros financeiros são preservados. |
| Reconciliação | `SubscriptionMaintenance::reconcile()` pagina cobranças das assinaturas já vinculadas e reaplica o mesmo processamento idempotente; recupera evento de pagamento perdido. `expire()` persiste expirações independentemente do gateway. Ativação operacional do Scheduler depende do ambiente. |
| Reativar assinatura cancelada | **Pendente.** Exige política de novo contrato e reconciliação; o pagamento atrasado de contrato cancelado não reinicia acesso. |

## Entidades e integridade

As dez entidades exigidas pela missão existem nas migrations Laravel: `plans`, `plan_versions`, `plan_entitlements`, `subscriptions`, `billing_customers`, `invoices`, `payments`, `webhook_events`, `usage_counters`, `subscription_audit_logs`. `billing_checkout_attempts` registra a operação externa e sua chave de idempotência.

- UUIDs preserváveis na futura importação; nenhuma consulta ao banco real foi feita.
- `subscriptions.organization_id` é único, evitando contratos paralelos acidentais no mesmo tenant. ID de assinatura e cliente externos são únicos por provedor.
- FKs compostas vinculam `invoices`, auditoria e checkout à mesma organização da assinatura; payments à mesma organização da invoice.
- Catálogo versionado mantém os termos de assinaturas já existentes; alteração comercial exige nova versão, não edição retroativa do preço contratado.
- Invoice/payment têm identidade externa única; eventos têm unicidade `(provider, provider_event_id)`.
- Consumo não negativo, valores financeiros não negativos e estorno limitado ao valor registrado por constraints.
- Cancelamento usa exclusivamente `canceled` no domínio de assinatura. `cancelled` continua sendo um estado de agendamento, sem mistura dos dois contratos.
- Exclusão em cascata de organização não apaga histórico financeiro: as referências usam `RESTRICT`.

## Estados e acesso

| Estado | Acesso a novas operações pagas |
|---|---|
| `pending` | Recusado até confirmação válida. |
| `trialing` | Permitido somente antes de `trial_ends_at`. |
| `active` | Permitido somente antes de `current_period_end`. |
| `past_due` | Permitido somente antes de `grace_ends_at`, quando configurado. |
| `suspended` | Recusado. |
| `canceled` | Recusado. |

As verificações usam o relógio do servidor mesmo que o Scheduler esteja parado. A leitura do histórico, exportação, administração e regularização não passa pelo bloqueio de criação paga. Uma assinatura pode manter `status=active` até a manutenção persistir a expiração, mas `has_access=false` e o enforcement recusam criação desde o instante do vencimento.

No cenário local, o período mensal é calculado a partir do vencimento da cobrança, em `America/Sao_Paulo`, com adição de mês sem overflow. Aniversários em fim de mês, periodicidade anual, descontos, estorno parcial e divergência de preço exigem homologação de política antes do piloto. Uma divergência não é silenciosamente aceita: o evento fica falho para reconciliação.

## Cotas e concorrência

`EntitlementService::assertCanCreate($organizationId, $resource)` e `consume($organizationId, $resource, $amount=1)` são chamados pela action protegida **dentro da mesma transação** da gravação. `consume` revalida o acesso e a cota; o lock na assinatura serializa concorrentes.

| Recurso | Semântica local |
|---|---|
| `professionals` | Inventário atual de profissionais ativos; assert antes do INSERT, consume depois do INSERT. Reativação também deve passar pelo mesmo gate. |
| `appointments` | Consumo de criações no mês do relógio do tenant; cancelar não devolve consumo. Idempotência da criação impede cobrar duas vezes o mesmo comando. |
| `messages` | Contador mensal; fixture tem limite zero porque nenhum provedor foi homologado. |
| `premium` | Entitlement booleano representado por limite 0/1. |
| `settings` | Entitlement booleano representado por limite 0/1. Configurações administrativas essenciais continuam acessíveis conforme autorização própria. |

O mês usa o timezone da organização: `2026-11-01T01:00Z` ainda consome `2026-10` em São Paulo. A escolha comercial entre mês de criação e mês da execução do atendimento permanece pendente; a semântica acima é explícita e sintética, não uma cláusula comercial aprovada.

Fixtures locais de demonstração, versão 2, espelham o catálogo React: Starter R$39/mês, um profissional e cem agendamentos; Pro R$69/mês, cinco profissionais e agendamentos ilimitados; Clínica R$99/mês, profissionais/agendamentos ilimitados; trial de catorze dias. Limite `null` significa ilimitado apenas para profissionais/agendamentos, e não equivale a entitlement ausente. As versões sintéticas anteriores permanecem no histórico. **Esses dados não constituem aprovação comercial para venda.** O catálogo sintético é ocultado fora de `local/testing`, mesmo se `BILLING_LOCAL_FIXTURES=true`.

## API e segurança

| Método/rota `/api/v1` | Autorização |
|---|---|
| `GET /plans` | Catálogo público mínimo. |
| `GET /billing/subscription` | Membership ativa do tenant da sessão. |
| `GET /billing/invoices` | Owner do tenant da sessão. |
| `POST /billing/checkout` | Owner, CSRF, `{plan_code}`, header `Idempotency-Key` de 16–80 caracteres. |
| `POST /billing/change-plan` | Owner, CSRF, `{plan_code}`. |
| `POST /billing/cancel` | Owner, CSRF, `{at_period_end:boolean}`. |
| `POST /billing/webhooks/asaas` | Token próprio `asaas-access-token`, rate limit; única exclusão CSRF do billing. |

O browser não escolhe organização, valor, owner, role ou prazo de trial. Headers de organização não substituem o contexto da sessão. Campos de tenant/preço são proibidos nos comandos de cobrança.

O token do webhook é comparado com `hash_equals`, deve ter pelo menos 32 caracteres e não é a API key. Token ausente/mal configurado retorna 503; token inválido retorna 401. A configuração oficial do Asaas deverá ainda validar todos os requisitos do token e os controles de origem/HTTPS no ambiente homologado. Asaas usa token compartilhado neste contrato, não uma assinatura HMAC de payload presumida.

Somente eventos `PAYMENT_*` com IDs de cobrança/assinatura entram neste endpoint inicial. Eventos desconhecidos, primeira assinatura não reconciliada, cliente divergente ou preço divergente retornam erro e não concedem acesso. O ledger guarda ID, tipo, hash dos identificadores, estado e tentativas; não guarda payload bruto, cartões, nomes ou tokens. Falhas do HTTP externo geram mensagens genéricas sem propagar corpo possivelmente pessoal para logs.

Evento processado retorna HTTP 200. Reentrega do mesmo ID não reaplica; o mesmo ID com recurso/tipo divergente retorna 409. O processamento bloqueia a assinatura antes de consultar seu estado financeiro atual, evitando aplicar um snapshot atrasado sobre uma alteração concorrente. O fluxo inicial é síncrono e limitado por timeout; antes de volume comercial, homologar a estratégia de outbox/fila e os tempos de resposta do Asaas.

## Provider e configuração

`BillingProvider` desacopla checkout, consulta de cobrança/listagem, troca de plano e cancelamento. `AsaasBillingProvider` é o primeiro adaptador. Por padrão, `BILLING_ENABLED=false` e `BILLING_HOMOLOGATED=false`; a API retorna indisponibilidade explícita em vez de pagamento simulado. Mesmo após esses flags, esta versão aceita apenas `https://api-sandbox.asaas.com/v3`. Produção requer alteração revisada e autorização própria.

Variáveis: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `BILLING_ENABLED`, `BILLING_HOMOLOGATED`, `BILLING_GRACE_DAYS`, `BILLING_LOCAL_FIXTURES`. Apenas exemplos sem segredos devem ser versionados. Não inserir chaves reais nos fixtures de teste.

O checkout recorrente inicial oferece cartão de crédito hospedado pelo Asaas. Pix convencional e boleto geram cobranças que dependem de ação do pagador; **não são renovação automática**. Pix Automático é outro produto/contrato e não foi habilitado. A disponibilidade efetiva de cartão recorrente, conta brasileira, meios de pagamento e condições comerciais da empresa ainda precisa ser confirmada na homologação.

## Evidências locais

Comando executado: `cd apps/api && php artisan test --filter Billing`.

Primeiro gate histórico em 25/10/2026: exit 0, **18 testes aprovados, 101 assertions**, PostgreSQL isolado. Inclui duas conexões reais em processos concorrentes disputando a última cota: somente uma consome, a outra recebe 403 e o contador termina em 1. Inclui isolamento de histórico, trial único, preço no servidor, checkout desabilitado/incerto/idempotente, token inválido, duplicidade, recurso divergente, estados atrasados, estorno, renovação, regularização, suspensão, mudança no próximo ciclo, cancelamento e reconciliação. Todos os HTTPs usam `Http::fake` e `Http::preventStrayRequests`.

As validações de integração do gateway, credenciais, primeira vinculação, liquidação, assinaturas/retentativas verdadeiras e compatibilidade dos payloads permanecem **não executadas**. Não há aprovação para faturar clientes.

O gate final integrado, após preservar os três planos do legado e a proteção de logs SQL, aprovou **72 testes e 499 assertions**; consulte `docs/qa/ACCEPTANCE_REPORT.md` e as evidências finais. Isso não substitui homologação real.

## Migração e gates externos

1. Obter autorização específica para snapshot e inventário Stripe/Supabase. Exportar IDs de organização, cliente, assinatura, invoices, pagamentos, eventos e cancelamentos em armazenamento restrito.
2. Reconciliar quem continua contratado no Stripe e quem muda de provedor; impedir recorrência simultânea. Não apagar, cancelar nem duplicar contratos por inferência.
3. Preservar UUIDs locais e IDs externos; importar histórico para ledger com origem explícita e verificar totais/relacionamentos. Nenhuma migração real foi executada nesta etapa.
4. Homologar a correlação checkout → assinatura → cliente com eventos autênticos e GETs de confirmação, inclusive ordem invertida, timeout de checkout e reentrega após erro.
5. Definir preços, versões, trial, regularização, pró-rata/crédito, downgrade abaixo do consumo atual, estorno parcial, cancelamento e recontratação. Converter apenas decisões aprovadas em catálogo comercial.
6. Executar ciclos sandbox completos: contratação, pagamento válido/inválido, renovação, falha, recuperação, upgrade/downgrade, cancelamento imediato/futuro, estorno, duplicação e atraso.
7. Habilitar Scheduler/reconciliação, métricas de eventos falhos e procedimento de recuperação da fila do provedor, com evidências. Homologar latência e decidir fila/outbox quando necessário.

## Fontes oficiais consultadas

Consulta em 25/10/2026, usadas para o contrato do adaptador, não como evidência de execução:

- [Checkout recorrente](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente) e [criação do checkout](https://docs.asaas.com/reference/criar-novo-checkout): cartão hospedado, recorrência e referência externa.
- [Webhook FAQ](https://docs.asaas.com/docs/webhooks-faq): autenticação própria, repetição e resposta HTTP 200.
- [Eventos de cobranças](https://docs.asaas.com/docs/payment-events) e [consulta de uma cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca): estados e consulta autoritativa para conciliação.
- [FAQ de assinaturas](https://docs.asaas.com/docs/faq-assinaturas): meios de pagamento e ciclo recorrente.
- [Eventos de assinatura](https://docs.asaas.com/docs/eventos-para-assinaturas) e [checkout](https://docs.asaas.com/docs/eventos-para-checkout): fronteira ainda pendente de primeira vinculação.
