# SPEC-008 — Proteção contra no-show e sinal de reserva

**Status:** proposta
**Prioridade:** P1
**Dependências:** SPEC-005, SPEC-006 e SPEC-007

## Objetivo
Reduzir faltas com confirmação automática, regras de cancelamento e cobrança opcional de sinal por agendamento.

## Escopo
- políticas por organização e serviço: antecedência, valor/percentual de sinal e janela de cancelamento;
- mensagens de confirmação, cancelamento e reagendamento por link seguro;
- checkout de sinal e estado de pagamento vinculado ao agendamento;
- expiração automática de reserva não paga e registro de no-show.

## Fora do escopo
POS presencial completo, parcelamento, cobrança recorrente do consumidor e conciliação bancária.

## Requisitos funcionais
1. O cliente deve visualizar a política antes de confirmar a reserva.
2. O pagamento de sinal deve ser idempotente e não alterar o valor pelo browser.
3. Agendamento pendente de sinal deve expirar sem gerar horário fantasma.
4. Cancelamentos dentro da política devem seguir o status e a regra configurados pela organização.

## Critérios de aceite
- [ ] Uma reserva com sinal só fica confirmada após pagamento validado no servidor.
- [ ] Redelivery do webhook não duplica pagamento nem confirmação.
- [ ] Links de confirmação/cancelamento expiram e não permitem operar outro agendamento.
- [ ] Relatório distingue confirmado, cancelado, no-show, sinal pago e reembolsado.

## Métricas
Taxa de no-show, confirmação, sinal convertido, cancelamento tardio e receita protegida.
