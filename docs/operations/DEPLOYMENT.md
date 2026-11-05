# DEPLOYMENT — Agenda Fácil SaaS (backend Laravel)

> Procedimento operacional do novo backend. **Não altera produção/Supabase/Netlify** até cutover autorizado.

## Stack

- Laravel 13 (PHP 8.4), API REST versionada (`/api/v1`), Sanctum (SPA).
- PostgreSQL 18 — fonte autoritativa.
- Storage privado S3-compatível (MinIO em dev; S3 em produção).
- Docker Compose para desenvolvimento.

## Desenvolvimento local

```bash
# 1. Banco + storage
docker compose up -d db minio

# 2. Backend
cd backend
cp .env.example .env
php artisan key:generate
php artisan migrate --seed            # inclui PlanCatalogSeeder
php artisan serve                     # http://localhost:8000
```

> Toolchain PHP: em ambientes onde PHP não está no PATH padrão, ative-o (ex.: `source ../backend-dev-env.sh` neste sandbox, que aponta PHP 8.4 via mise + libs).

## Variáveis de ambiente relevantes

`DB_*` (PostgreSQL) · `SANCTUM_STATEFUL_DOMAINS` (domínio da SPA Angular) · `SESSION_DOMAIN` · `BILLING_PROVIDER` (`fake|stripe|asaas`) · `STRIPE_*` / `ASAAS_*` (credenciais do gateway) · `APP_URL` / `FRONTEND_URL`.

## Qualidade antes de deploy (ADR-005)

```bash
cd backend
./vendor/bin/pint --test        # estilo
php artisan test                # suíte Pest
```

CI deve rodar lint + testes + migrações antes de qualquer publicação (ver `.github/workflows/`).

## Migração de dados (Fase C — requer autorização)

1. **Dump** do Supabase vivo (schema + dados) — bloqueio externo atual.
2. Import para PostgreSQL próprio preservando **IDs/UUID** e relacionamentos.
3. Reset de senhas: hashes do Supabase (GoTrue) **não** são presumidos compatíveis → fluxo de redefinição no primeiro acesso.
4. Reconciliação de billing contra o gateway **antes** do cutover.

## Staging / produção (resumo)

- Container PHP-FPM + Nginx (ou `php artisan serve` apenas para dev).
- Fila (`queue:work`) e Scheduler (`schedule:run`) somente quando necessários (lembretes, `suspendExpiredGrace`).
- HTTPS obrigatório; cookies de sessão `HttpOnly`/`Secure`; CSRF via Sanctum.
- Webhooks do gateway com endpoint dedicado e rate limit (`throttle:webhooks`).

## Observação sobre este sandbox

O runtime de containers (podman) está indisponível neste ambiente de avaliação — o `docker-compose.yml` é o setup entregue para ambientes reais. A validação aqui usou SQLite em memória para o loop de testes; o PostgreSQL 18 continua sendo o alvo autoritativo (migrações escritas de forma compatível, com índice parcial específico de PostgreSQL).
