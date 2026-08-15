# ADR-007 — Disponibilidade da agenda é transacional e server-side

**Status:** aceito
**Data:** 2026-08-15

## Contexto

Constraints de exclusão protegem apenas uma tabela. A agenda também precisa respeitar expediente, serviço, profissional e bloqueios em outra tabela, sem deixar uma chamada direta do browser contornar essas regras.

## Decisão

A função privada `public.manage_appointment_command` é a única camada de escrita de agendamentos e bloqueios. Ela recebe o ator autenticado da Edge Function, obtém seu perfil no banco, adquire `pg_advisory_xact_lock` por organização e calcula o intervalo final a partir da duração do serviço.

Antes da escrita, a função valida o expediente no timezone da organização, o vínculo do profissional e colisões com bloqueios. As constraints `gist` continuam como defesa final contra sobreposição. O acesso `authenticated` às tabelas de agenda passou a ser somente leitura; a RPC é executável apenas pelo `service_role`.

## Consequências

- concorrência entre comandos da mesma organização é serializada e resulta em `409` quando o horário já foi tomado;
- horário final e organização não são controlados pelo browser;
- bloqueios globais e por profissional são consistentes com novas reservas;
- qualquer integração futura deve usar a Edge Function, não DML direto ou a RPC privada.
