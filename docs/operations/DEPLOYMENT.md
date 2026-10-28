# Operação e preparação de staging

**Estado:** ambiente de desenvolvimento local; nenhum deploy remoto autorizado ou executado. O Compose é de desenvolvimento, com valores sintéticos, loopback e servidores de desenvolvimento. Não reutilizar esse arquivo diretamente em produção.

## Desenvolvimento reproduzível

Pré-requisitos: Git, Docker/Compose, `rg`; instalar dependências somente neste checkout. Portas4200/8000/8025/55439 precisam estar livres. O projeto Compose chama-se `agenda-facil-migration` e seu volume PostgreSQL é separado dos demais projetos.

```sh
bash scripts/migration/setup-local.sh
docker compose ps
```

Frontend: http://localhost:4200; API: http://localhost:8000; caixa postal **sintética**: http://localhost:8025. `setup-local.sh` cria apenas `.env` local ausente, instala lockfiles, gera APP_KEY se vazia e aplica migrations aditivas no banco local. Não regenera chave existente, não restaura dump real e não inicializa Supabase.

Composer/PHP também podem rodar no host: PHP>=8.4 com pdo_pgsql, intl, mbstring, bcmath, zip e pcntl para concorrência. Ambiente verificado: PHP 8.5.11, Laravel 13 com lockfile, Angular 22/Node 24, PostgreSQL 18.6. O `.env.example` da API usa porta55439 no host; Compose sobrescreve DB_HOST/PORT e limpa DB_URL para impedir conexão fora do banco local. `artisan serve --no-reload` conserva essas variáveis no subprocesso HTTP.

## Checks

```sh
npm ci
npm test
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
cd apps/api
composer validate --strict
composer audit
php artisan test
vendor/bin/pint --test
cd ../web
npm ci
npm test
npm run build
npm run test:e2e
```

PHPUnit usa exclusivamente `agenda_facil_test` no PostgreSQL local. Não executar testes concorrentes entre processos de suíte: RefreshDatabase/DatabaseMigrations limpam a base descartável. E2E usa `agenda_facil` com registros sintéticos únicos, sem reset do banco de desenvolvimento. O teste de portal usa SMTP/Mailpit local; nenhuma mensagem é enviada a pessoas reais. Os testes legados Supabase ficam opt-in manual no workflow, exigindo ambiente de teste autorizado.

## Backups locais e restore

```sh
bash scripts/migration/verify-local-restore.sh
```

O script faz pg_dump do Compose local, cria banco temporário, restaura, compara contagens e remove somente o banco temporário. O dump em `.migration-backups/` é ignorado pelo Git. Executar com dados sintéticos e sem escrita concorrente. O bundle Git do baseline foi verificado; ele não contém dados Supabase nem substitui backup de banco/storage.

## Gate de staging e produção

1. Aprovar ambiente, domínio, janela e executor. Preparar secrets por mecanismo próprio, sem Git; PHP e PostgreSQL com patches suportados. Runtime sem privilégios de migrations/superuser.
2. Servir Angular build estático e API por servidor adequado com HTTPS e mesma origem/reverse proxy. Proteger trusted proxies/hosts; APP_DEBUG=false, APP_ENV=production, APP_KEY segura, cookies Secure/HttpOnly/SameSite e SESSION_ENCRYPT=true. HTTPS e headers de segurança precisam de teste no proxy real.
3. Storage S3 privado, bucket/credencial de menor privilégio, criptografia e backup; validar assinatura/autorização, conteúdo, indisponibilidade e restauração de objetos. Não executar `storage:link` para arquivos privados.
4. Instalar dependências travadas e migrations compatíveis após backup/restore aprovado. Separar configuração comercial das fixtures; planos sintéticos são ocultados fora de local/testing e não podem ser vendidos.
5. Homologar Asaas em sandbox, inclusive correlação inicial checkout/cliente/assinatura, mudanças/cancelamentos e reconciliação. Não habilitar produção por alteração de URL/flags sem revisão. Preservar referências e histórico Stripe.
6. Configurar Scheduler somente para comandos implementados e homologados; reconciliação de billing não cria cobranças, mas chama gateway e depende de configuração autorizada. Queue de mensagens só quando houver outbox/provedor e necessidade comprovada. Meta/Twilio e templates permanecem pendentes.
7. Implantar observabilidade sem payload sensível, alertas de webhook falho, falha de backup/storage e cotas. Definir RPO/RTO, retenção, responsáveis e ensaiar recuperação.
8. Executar relatório de aceite, QA visual/teclado, isolamento com runtime real, restore, migração e rollback. Registrar aprovação humana antes de cutover. GitHub Actions só está configurado; execução remota depende de push autorizado e não foi atribuída como aprovada.

## Limitações operacionais atuais

Compose funcional não equivale a staging. Nenhuma conta externa, bucketS3 real, provedor de mensagem, credencial, domínio, HTTPS remoto ou dado real foi alterado. Instalações/versões e comandos comprovados estão em `docs/qa/ACCEPTANCE_REPORT.md`; pendências de produto em STATUS.
