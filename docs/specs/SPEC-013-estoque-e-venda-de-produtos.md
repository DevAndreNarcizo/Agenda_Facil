# SPEC-013 — Estoque e venda de produtos

**Status:** proposta
**Prioridade:** P2
**Dependências:** SPEC-011

## Objetivo
Controlar produtos vendidos e consumidos nos atendimentos, evitando ruptura de estoque e perda operacional.

## Escopo
- cadastro de produto, SKU, custo, preço, fornecedor e estoque mínimo;
- entradas, saídas, perdas, inventário e ajustes com motivo;
- baixa por venda ou consumo de serviço;
- alertas de estoque crítico;
- relatório de giro, margem estimada e divergências.

## Fora do escopo
Compras automatizadas, multiestoque, integração com fornecedor e emissão fiscal.

## Requisitos funcionais
1. Saldo é derivado de movimentações imutáveis, não editado diretamente.
2. Venda concorrente não pode deixar estoque negativo quando bloqueio estiver ativo.
3. Ajustes exigem motivo e usuário responsável.
4. Produto inativo preserva histórico de venda e atendimento.

## Critérios de aceite
- [ ] Cada venda reduz o estoque uma única vez.
- [ ] Reversão/estorno recompõe estoque conforme a política.
- [ ] Alertas aparecem ao atingir o mínimo configurado.
- [ ] Relatório identifica itens sem giro e perdas.
