# SPEC-007 — Reserva pública e canais de aquisição

**Status:** em implementação
**Prioridade:** P1
**Dependências:** SPEC-002, SPEC-003 e SPEC-004

## Objetivo
Transformar a agenda em canal de aquisição com página pública por organização, link compartilhável, QR Code e widget incorporável.

## Escopo
- rota pública baseada no `slug` da organização;
- catálogo público de serviços, profissionais e disponibilidade real;
- link de reserva, QR Code e widget para sites parceiros;
- parâmetros de origem (Instagram, Google, QR, site e indicação);
- conversão para sessão segura do portal antes de concluir a reserva.

## Fora do escopo
Marketplace próprio, ranking público de empresas e integração certificada com Google Reserve.

## Requisitos funcionais
1. Cada organização pode ativar/desativar a reserva pública e escolher serviços/profissionais exibidos.
2. O widget não pode expor chave privilegiada, dados de outros negócios ou disponibilidade inconsistente.
3. A reserva deve usar a mesma validação de conflito, expediente e timezone da agenda interna.
4. A origem da reserva deve ser registrada para métricas de conversão.

## Critérios de aceite
- [ ] Um visitante reserva por URL pública sem informar `organization_id` manualmente.
- [ ] QR Code e widget levam ao mesmo fluxo seguro.
- [x] Slots indisponíveis não podem ser confirmados por manipulação do navegador.
- [ ] Dashboard mostra reservas por canal de origem.

## Métricas
Visitas, início de reserva, reservas concluídas, conversão por canal e abandono do funil.
