# SPEC-009 — Lista de espera e encaixes automáticos

**Status:** proposta
**Prioridade:** P1
**Dependências:** SPEC-004, SPEC-006 e SPEC-008

## Objetivo
Preencher horários liberados por cancelamentos com clientes interessados, reduzindo ociosidade da agenda.

## Escopo
- entrada na lista de espera por serviço, profissional opcional e faixas de horário;
- ordenação transparente por compatibilidade e momento de entrada;
- oferta com link de reserva de curta duração;
- expiração, recusa e próxima tentativa sem duplicar reservas;
- alertas para cliente e equipe.

## Fora do escopo
Precificação dinâmica, leilão de horários e disparos em massa de marketing.

## Requisitos funcionais
1. A oferta só pode ser criada para slot realmente disponível.
2. Uma oferta possui expiração e pode ser aceita apenas uma vez.
3. Ao aceitar, a reserva usa a mesma proteção concorrente da agenda.
4. O cliente pode sair da lista de espera a qualquer momento.

## Critérios de aceite
- [ ] Cancelar um agendamento elegível cria no máximo uma oferta ativa por slot.
- [ ] Duas aceitações concorrentes resultam em apenas uma reserva confirmada.
- [ ] Expiração chama o próximo cliente compatível sem reenviar a mesma oferta.
- [ ] Dashboard mede conversão e receita recuperada por encaixe.
