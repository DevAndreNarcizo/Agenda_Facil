# ADR-003 — Portal usa sessão opaca de curta duração

**Status:** aceito — implementado no ambiente remoto de teste
**Data:** 2026-08-15

## Continuidade Laravel — 25/10/2026

O novo `CustomerPortal` preserva sessão opaca, hash, expiração, revogação e escopo de cliente/tenant. A SPA recebe cookie HttpOnly separado do proprietário; o acesso local é comprovado por link email de uso único, em fragmento removido após leitura. Mudança de email invalida o acesso e não há token no localStorage. Mailpit é transporte sintético de desenvolvimento; o canal OTP/WhatsApp do legado e SMTP real continuam sujeitos à configuração e homologação. A migração não presume hashes ou sessões Supabase compatíveis. Ver SPEC-017 e relatório de aceite.

## Contexto
IDs de cliente no localStorage são manipuláveis e não constituem autenticação.

## Decisão
Após OTP validado, o servidor emitirá token aleatório opaco. Apenas o hash é persistido; toda operação de portal valida a sessão no servidor. O token expira e pode ser revogado.

## Consequências
- elimina confiança em IDs locais;
- exige novas Edge Functions e tabelas de sessão;
- frontend do portal deixa de fazer inserts/selects diretos no Supabase.
- a ativação operacional depende de `PORTAL_TOKEN_PEPPER` e dos secrets de WhatsApp.
