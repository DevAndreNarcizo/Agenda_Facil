# SPEC-012 — Comissões, metas e repasse de profissionais

**Status:** proposta
**Prioridade:** P2
**Dependências:** SPEC-011

## Objetivo
Automatizar o cálculo transparente de comissões, metas e repasses da equipe a partir de atendimentos e vendas pagos.

## Escopo
- regras fixas, percentuais, por serviço, produto ou faixa de meta;
- vigência e histórico de regras;
- comissão sobre valor líquido, gorjeta e desconto conforme política;
- demonstrativo por profissional e período;
- aprovação e marcação de repasse pago.

## Fora do escopo
Folha de pagamento, vínculo trabalhista, impostos e integração bancária de pagamento.

## Requisitos funcionais
1. Comissão nasce somente de receita elegível e confirmada.
2. Alterar uma regra não pode recalcular períodos já fechados sem ajuste explícito.
3. Estorno gera ajuste rastreável de comissão.
4. Profissional vê somente seus próprios demonstrativos.

## Critérios de aceite
- [ ] Dois fechamentos concorrentes não geram comissão duplicada.
- [ ] Mudança de regra respeita data de vigência.
- [ ] Owner visualiza consolidação; profissional visualiza apenas seu saldo.
- [ ] Relatório mostra base de cálculo, ajustes e repasse pendente/pago.
