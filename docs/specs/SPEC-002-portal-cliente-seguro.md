# SPEC-002 — Portal do Cliente com sessão segura

**Status:** proposta
**Prioridade:** P0

## Problema

O portal atual confia em IDs gravados no `localStorage`; qualquer pessoa pode alterar esses valores e tentar operar em nome de outro cliente.

## Solução

Criar Edge Functions `request-portal-otp`, `verify-portal-otp`, `portal-session` e `portal-booking`. O navegador mantém apenas um token aleatório de sessão, opaco, de curta duração; o banco armazena somente seu hash, cliente, organização, expiração e revogação.

## Requisitos

- OTP com hash/HMAC, expiração de 5 minutos, consumo único e máximo de 5 tentativas;
- rate limit por telefone e IP; resposta não enumerável;
- código nunca retorna ao browser, logs ou toast;
- toda consulta e reserva valida token de sessão no servidor;
- reserva revalida serviço, organização, expediente, fuso `America/Sao_Paulo` e conflito;
- logout revoga a sessão.

## Critérios de aceite

1. Alterar localStorage não permite acessar agendamento de outro cliente.
2. OTP não aparece na resposta HTTP, console ou interface.
3. Reuso, expiração e excesso de tentativas são negados.
4. Booking sem token válido retorna 401; conflito retorna 409.
