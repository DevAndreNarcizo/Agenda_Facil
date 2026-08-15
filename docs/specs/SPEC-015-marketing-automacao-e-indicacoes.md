# SPEC-015 — Marketing, automação e indicações

**Status:** proposta
**Prioridade:** P2
**Dependências:** SPEC-006, SPEC-007 e SPEC-010

## Objetivo
Gerar retorno de clientes sem spam, por campanhas segmentadas, automações de ciclo de vida e indicação rastreável.

## Escopo
- consentimento e preferências de comunicação por canal;
- segmentos: novo, recorrente, inativo, aniversário, no-show e alto valor;
- campanhas WhatsApp/email com template aprovado e limite de frequência;
- automações de pós-atendimento, reativação e aniversário;
- cupons e códigos de indicação com atribuição de conversão.

## Fora do escopo
Disparo irrestrito, compra de base de contatos, IA autônoma para mensagens e integração completa com plataforma de anúncios.

## Requisitos funcionais
1. Comunicação só é enviada a clientes com consentimento válido para o canal.
2. Cada campanha possui público estimado, prévia, responsável e métricas.
3. Opt-out é imediato e auditável.
4. Eventos de campanha não podem registrar conteúdo sensível em logs.

## Critérios de aceite
- [ ] Cliente sem opt-in não recebe campanha.
- [ ] Um cliente não recebe duas vezes a mesma automação.
- [ ] Dashboard mostra entrega, abertura quando disponível, clique, reserva e receita atribuída.
- [ ] Cupom de indicação não pode ser resgatado fora da regra definida.
