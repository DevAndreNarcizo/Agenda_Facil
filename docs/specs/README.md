# Roadmap de SPECs — Agenda Fácil

## Fundação existente

| SPEC | Tema | Estado |
|---|---|---|
| 001 | Segurança multitenant e RLS | Em implementação no teste |
| 002 | Portal do cliente seguro | Infraestrutura no teste |
| 003 | Onboarding transacional | Implementada no teste |
| 004 | Agenda operacional | Implementada no teste |
| 005 | Mensageria e cobrança confiáveis | Implementada no teste; credenciais pendentes |

## Crescimento e operação propostos

| Ordem | SPEC | Tema | Prioridade | Dependência principal |
|---:|---|---|---|---|
| 1 | 006 | Ativação de integrações externas | P0 | 005 |
| 2 | 007 | Reserva pública e aquisição | P1 | 002, 004 |
| 3 | 008 | No-show e sinal | P1 | 006, 007 |
| 4 | 009 | Lista de espera e encaixes | P1 | 004, 008 |
| 5 | 011 | PDV, caixa e recebimentos | P2 | 004, 008 |
| 6 | 010 | Fidelidade, pacotes e gift cards | P2 | 008, 011 |
| 7 | 012 | Comissões, metas e repasse | P2 | 011 |
| 8 | 013 | Estoque e venda de produtos | P2 | 011 |
| 9 | 014 | Prontuário e consentimento | P2 | 001, 002, 004 |
| 10 | 015 | Marketing, automação e indicação | P2 | 006, 007, 010 |
| 11 | 016 | Analytics avançado | P2 | 007, 008, 011, 012, 015 |

## Estratégia

A ordem prioriza conversão, redução de no-show e receita antes de módulos com maior complexidade operacional ou regulatória. Marketplace, emissão fiscal, folha e integração bancária permanecem fora do roadmap atual.
