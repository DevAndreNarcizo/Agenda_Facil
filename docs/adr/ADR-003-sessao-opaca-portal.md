# ADR-003 — Portal usa sessão opaca de curta duração

**Status:** aceito — implementado no ambiente remoto de teste
**Data:** 2026-08-15

## Contexto
IDs de cliente no localStorage são manipuláveis e não constituem autenticação.

## Decisão
Após OTP validado, o servidor emitirá token aleatório opaco. Apenas o hash é persistido; toda operação de portal valida a sessão no servidor. O token expira e pode ser revogado.

## Consequências
- elimina confiança em IDs locais;
- exige novas Edge Functions e tabelas de sessão;
- frontend do portal deixa de fazer inserts/selects diretos no Supabase.
- a ativação operacional depende de `PORTAL_TOKEN_PEPPER` e dos secrets de WhatsApp.
