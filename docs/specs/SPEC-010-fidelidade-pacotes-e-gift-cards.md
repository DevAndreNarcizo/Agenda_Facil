# SPEC-010 — Fidelidade, pacotes e gift cards

**Status:** proposta
**Prioridade:** P2
**Dependências:** SPEC-008 e SPEC-011

## Objetivo
Aumentar recorrência e receita antecipada com pontos, pacotes de serviços, gift cards e benefícios configuráveis.

## Escopo
- carteira do cliente com pontos, créditos, pacotes, gift cards e validade;
- regras por organização para acúmulo, resgate e expiração;
- compra, transferência limitada e uso em checkout;
- histórico imutável de movimentações;
- benefícios por nível ou frequência.

## Fora do escopo
Programa compartilhado entre empresas, moeda conversível em dinheiro e marketplace de benefícios.

## Requisitos funcionais
1. Saldo não pode ser alterado diretamente pelo browser.
2. Cada crédito, débito, estorno ou expiração precisa de evento auditável.
3. O uso em checkout deve ser transacional para evitar saldo negativo.
4. Gift card deve poder ser usado parcialmente até expirar.

## Critérios de aceite
- [ ] Duas tentativas simultâneas não consomem o mesmo crédito duas vezes.
- [ ] Estorno recompõe o benefício conforme a política configurada.
- [ ] Cliente e equipe visualizam saldo, validade e histórico.
- [ ] Relatório mostra receita antecipada, resgates e retenção por benefício.
