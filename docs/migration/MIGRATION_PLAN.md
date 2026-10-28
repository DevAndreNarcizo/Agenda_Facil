# Plano de migração reversível

Fonte técnica e contratos: [SPEC-017](../specs/SPEC-017-migracao-saas.md). Inventário: [AUDIT](AUDIT.md). Progresso comprovado: [STATUS](../implementation/STATUS.md). Não usar este plano como evidência de funcionalidade aprovada.

| Fase | Meta estimada | Entrega e gate |
|---|---|---|
| A | 25/10–01/11 | Auditoria do código recente, baseline, bundle Git, backup real somente autorizado |
| B | até 01/11 | Angular/Laravel paralelos; cadastro/login/logout/onboarding Sanctum; testes locais |
| C | até 08/11 | Schema completo PostgreSQL 18, memberships, policies, FKs, negativos multi-tenant; restore sintético |
| D | 09–29/11 | Paridade das12 áreas por fluxos, disponibilidade, portal e identidade; E2E e responsividade |
| E | até 06/12 | Catálogo/cotas, checkout/renovação/falha/mudança/cancelamento; eventos autenticados; homologação Asaas |
| F | 07–15/12 | Segurança, concorrência/timezone, dependências, acessibilidade e QA visual; candidato a piloto |
| G | 16/12–31/01/2027 | Staging autorizado, ensaio de migração/rollback, operação e homologação final |

Estimativa reavaliada em 25/10: janela até piloto é de aproximadamente7 semanas. O produto só é candidato se todos os gates críticos passarem; credenciais, homologação e decisões contratuais podem deslocar a data. Sinal/lista de espera ficam após núcleo; ERP, estoque e prontuário fora do piloto.

## Execução e preservação

1. Manter `main` e React intactos como fonte legada; branch migration sem commit/push/deploy automáticos. Registrar qualquer mudança pequena no legado e repetir seus checks.
2. Desenvolver em banco local sintético com migrations Laravel independentes. Nunca aplicar SQL legado companies no banco canônico.
3. Validar cada vertical por API e Angular, incluindo estados negado/erro/vazio e dois tenants. Dados de demo são identificados como sintéticos.
4. Antes de importação real: autorização específica, inventário de schema/histórico, backup criptografado, checksum e restore isolado; preservar UUIDs/FKs, medir órfãos/duplicatas, mapear profiles para membership/professional.
5. Exportar referências Stripe, subscriptions, invoices e pagamentos; reconciliar com gateway sem criar cobrança dupla. Asaas só após decisão/homologação para empresa brasileira.
6. Preparar redefinição de senha e invalidação de sessões Supabase. Comunicar janela e recuperação, sem assumir compatibilidade de hashes.
7. Ensaiar cutover em staging: congelamento de escrita, snapshot final, importação validada, smoke tests, fonte de escrita única, monitoramento e critérios de rollback.
8. Somente desativar React após paridade documentada, aprovação, rollback ensaiado e conservação do histórico pelo período definido.

## Bloqueios externos

Snapshot e inventário Supabase/Stripe autorizados; conta sandbox Asaas habilitada e permissão para ciclos reais; homologação de cartão/Pix Automático; templates Meta; domínio/HTTPS/staging; política de grace period/retenção/exportação e revisão jurídica. Nenhum deles autoriza alteração remota por inferência.
