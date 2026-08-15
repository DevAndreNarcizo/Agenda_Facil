# SPEC-016 — Analytics avançado e inteligência operacional

**Status:** proposta
**Prioridade:** P2
**Dependências:** SPEC-007, SPEC-008, SPEC-011, SPEC-012 e SPEC-015

## Objetivo
Converter dados operacionais em decisões sobre ocupação, receita, retenção e aquisição.

## Escopo
- funil visita → reserva → confirmação → comparecimento → pagamento;
- no-show, ocupação, ticket médio, retorno, LTV e receita por canal;
- produtividade e capacidade por profissional, serviço e período;
- coortes de retenção e reativação;
- exportação CSV e filtros por período, profissional e origem.

## Fora do escopo
Recomendação automatizada de preço, decisão financeira autônoma, data warehouse externo e treinamento de modelos proprietários.

## Requisitos funcionais
1. Métricas devem ter definição exibida na interface e considerar timezone `America/Sao_Paulo`.
2. Cancelamentos, estornos e dados de teste não podem inflar receita ou conversão.
3. Consultas devem respeitar isolamento multitenant e paginação/limites de custo.
4. Agregados devem poder ser recalculados de forma idempotente.

## Critérios de aceite
- [ ] Dois usuários de organizações distintas recebem números isolados.
- [ ] Receita prevista, recebida e estornada aparecem separadas.
- [ ] Funil permite identificar abandono e no-show por canal.
- [ ] Exportação reproduz os valores exibidos no dashboard para o mesmo filtro.
