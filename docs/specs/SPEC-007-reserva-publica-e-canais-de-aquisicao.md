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
- [x] QR Code e widget levam ao mesmo fluxo seguro.
- [x] Slots indisponíveis não podem ser confirmados por manipulação do navegador.
- [x] Dashboard mostra reservas por canal de origem.

## Métricas
Visitas, início de reserva, reservas concluídas, conversão por canal e abandono do funil.

## Implementação frontend

- O painel de configurações oferece QR Code visual para a URL pública com `src=qr` e um iframe copiável com `src=site`.
- A página pública emite `page_viewed`, `booking_started`, `identity_verification_requested` e `booking_completed` em `sessionStorage` e em um `CustomEvent` local. Os eventos não incluem dados de cliente, telefone, e-mail ou token.
- O dashboard agrega `appointments.booking_source` dos agendamentos acessíveis pela RLS da organização, com paginação no cliente para não truncar o resultado em organizações maiores.

## Limitações conhecidas

- Os eventos de funil ainda não são persistidos no servidor; portanto, visitas, abandono e conversão por canal não são métricas consolidadas entre navegadores. Exigem endpoint/tabela de analytics ou integração de telemetria com credenciais próprias.
- O QR Code é renderizado por `api.qrserver.com` a partir de uma URL de reserva já pública. Caso a política de rede/CSP do ambiente bloqueie esse host, será necessário adicionar uma biblioteca de QR Code ao bundle ou disponibilizar um gerador interno.
