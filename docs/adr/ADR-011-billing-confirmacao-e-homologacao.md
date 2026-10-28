# ADR-011 — Billing versionado e confirmado pelo provedor

Status: aceito para núcleo local; homologação e política comercial pendentes.
Data: 25/10/2026.

## Contexto

O legado cria checkout/trial a cada solicitação e marca active em checkout concluído. Isso não comprova recebimento nem protege recorrência, cotas e eventos atrasados.

## Decisão

Billing é domínio próprio, atrás de `BillingProvider`. Catálogo, versões, entitlements, ledger, clientes, assinaturas, invoices/payments e consumo ficam no PostgreSQL. Valores locais são fixtures sintéticas e não constituem aprovação de preço/contrato. Trial é registrado uma vez por tenant e não é reiniciado por checkout. Não ativar acesso pelo retorno do browser nem pela mera criação da assinatura.

Asaas é a primeira opção, desabilitada por padrão. Webhook exige token próprio validado em tempo constante; estado financeiro precisa ser autenticado e reconciliável com o provedor. Eventos duplicados/atrasados não devem duplicar consumo, pagamentos ou reabrir assinatura cancelada. Não armazenar dados de cartão. Sem configuração/homologação, checkout retorna indisponibilidade explícita.

Cobranças recorrentes por Pix convencional exigem nova ação do pagador. Débito automático requer jornada/consentimento Pix Automático e disponibilidade homologada para a empresa. Ver [assinaturas](https://docs.asaas.com/docs/assinaturas), [Pix Automático](https://docs.asaas.com/docs/pix-automatico) e [autenticação de webhook](https://docs.asaas.com/docs/sobre-os-webhooks), consultados em 25/10/2026.

## Consequências

Testes com HTTP fake demonstram contrato local, não integração sandbox real. Renovação, falha, estorno, mudança e cancelamento precisam de homologação válida antes de piloto comercial. Assinaturas Stripe existentes serão inventariadas/reconciliadas mediante autorização; nenhuma exclusão nem criação de cobrança paralela automática.
