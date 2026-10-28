# ADR-010 — Migração incremental com PostgreSQL autoritativo

Status: aceito para implementação local pela missão de 25/10/2026. Cutover de produção pendente.

## Contexto

O produto React/Supabase já possui agenda transacional e proteções recentes. Removê-lo antes de verificar paridade perderia funcionalidades e poderia comprometer dados. O baseline SQL legado não inicializa um banco vazio de forma fiel.

## Decisão

Criar `apps/web` Angular22 standalone e `apps/api` Laravel13/PHP>=8.4 em monólito modular. Manter o React, seus assets, migrations e histórico. PostgreSQL18 é a única fonte autoritativa da aplicação nova; nenhum fallback localStorage, SQLite ou dupla escrita Supabase/Laravel. Compose recebe projeto, volume e portas próprios, vinculadas a loopback.

UUIDs são mantidos nas entidades importáveis; users, memberships e professionals são distintos. O tenant corrente é resolvido da sessão e de membership ativa consultada no servidor. Parâmetro de organização do navegador nunca concede acesso. Policies e consultas scoped são a defesa principal; FK composta e constraint GiST cobrem integridade/concorrência. RLS adicional exige papel PostgreSQL sem bypass e SET LOCAL em transação, não substitui autorização de aplicação.

Sanctum usa cookies e CSRF na mesma origem. Portal de clientes tem credenciais/sessão separadas. Migração real de identidade exigirá redefinição/recuperação e revogação; hashes/sessões Supabase não serão presumidos compatíveis.

## Consequências

Não há migração de dados reais nesta etapa. Exportação/importação, reconciliação financeira, corte de escrita, HTTPS, domínio e habilitação de produção dependem de autorização e gates. Rollback deve escolher uma fonte de escrita, reconciliar alterações e conservar o legado até paridade. As datas são metas condicionadas a evidências, não declaração de conclusão.

A instrução de bootstrap que acompanha o skeleton Laravel para instalar Boost foi substituída por regras do projeto: não há necessidade funcional demonstrada dessa dependência na missão.
