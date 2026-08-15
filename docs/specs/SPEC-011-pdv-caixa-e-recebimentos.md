# SPEC-011 — PDV, caixa e recebimentos

**Status:** proposta
**Prioridade:** P2
**Dependências:** SPEC-004 e SPEC-008

## Objetivo
Registrar o fechamento de atendimentos e vendas em uma operação simples de caixa, conectada à agenda e aos pagamentos.

## Escopo
- checkout de serviço, produto, adicional, desconto, taxa e gorjeta;
- formas de pagamento: dinheiro, Pix, cartão, link e crédito interno;
- abertura/fechamento de caixa, sangria e ajustes auditáveis;
- recibo digital e estorno;
- visão diária de recebimentos por profissional e forma de pagamento.

## Fora do escopo
Emissão fiscal nacional, adquirência própria, parcelamento complexo e contabilidade oficial.

## Requisitos funcionais
1. Todo recebimento deve referenciar atendimento, venda avulsa ou ajuste autorizado.
2. Alterações após fechamento devem preservar trilha de auditoria.
3. Desconto acima de limite requer papel autorizado.
4. Pagamentos online devem ser reconciliados por evento do provedor, nunca por retorno do browser.

## Critérios de aceite
- [ ] Fechar atendimento atualiza status, total e recebimentos de modo consistente.
- [ ] O caixa diário concilia entradas, saídas e saldo esperado.
- [ ] Estorno não apaga a venda original.
- [ ] Relatórios separam receita prevista, recebida e pendente.
