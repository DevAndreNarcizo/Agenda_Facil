# Agenda Fácil — API Laravel

Laravel 13, PHP >=8.4, PostgreSQL e Sanctum. O frontend Angular vive em `../web`; não é necessário executar o Vite do skeleton. Não foi instalado Laravel Boost: a missão exige dependências com necessidade demonstrada e os contratos locais já estão explícitos.

Copie `.env.example` para `.env` somente no ambiente local novo, execute `composer install`, `php artisan key:generate`, `php artisan migrate` e `php artisan serve`. O Compose da raiz fornece PostgreSQL isolado e a API. `.env.example` contém exclusivamente credenciais sintéticas locais; nunca reutilizá-las em produção. Não executar `composer setup` nem migrations no Supabase.

## Verificação

`php artisan test` usa PostgreSQL em `127.0.0.1:55439`, banco **agenda_facil_test**. O banco de teste é descartável. `vendor/bin/pint --test`, `composer validate --strict` e `composer audit` são checks complementares. Não executar testes simultaneamente em processos que compartilham esse banco.

## Contratos e limites

API `/api/v1`, envelope `{data: ...}`. A SPA obtém `/sanctum/csrf-cookie` antes de mutações e usa cookies de sessão HttpOnly. Tenant deriva da sessão e de membership ativa; headers e IDs do browser não escolhem organização. Controllers usam allowlists, policies e queries escopadas; appointments têm FKs compostas e GiST de sobreposição. Dados importáveis usam UUIDs.

A reserva pública aceita cliente novo, usa o mesmo comando transacional da agenda e devolve um segredo de cancelamento uma única vez. `Idempotency-Key` opcional com 16–128 caracteres protege retry da criação; payload diferente com a mesma chave recebe 409. O período suportado é de 90 dias e instantes devem conter offset ISO8601. Profissionais vinculados a membership permitem ao employee gerenciar sua própria agenda. Catálogos são limitados a 500 linhas nesta entrega; paginação completa e paridade de bloqueios da agenda ainda devem ser fechadas antes do piloto.

Convites têm token hash, expiração e aceite autenticado por e-mail correspondente. A entrega atual é manual e explícita; não há envio externo homologado. Password reset usa o broker Laravel; o mailer `array` local não entrega e-mails. Produção exige provedor configurado, URL de reset da SPA e teste completo de entrega antes da ativação.

Billing possui catálogo e entitlements server-side; fixtures locais são identificadas como sintéticas. Asaas permanece desabilitado até homologação. O storage S3 possui visibilidade privada, mas upload, download assinado e importação de arquivos legados ainda não foram ativados. Nenhum registro do Supabase/Stripe foi importado ou alterado.

As fases e pendências canônicas estão em `../../docs/implementation/STATUS.md` e `../../docs/qa/ACCEPTANCE_REPORT.md`.
