# ROLLBACK — Procedimento reversível

> O novo backend/front convive com o sistema atual (React/Supabase) **sem** substituí-lo até paridade verificada. Qualquer passo é reversível.

## Princípios

- Ambiente novo (Laravel/Angular/PostgreSQL) é **isolado**; produção React/Supabase/Netlify permanece intacta.
- Entregas por PR revisável na branch `migracao/saas-angular-laravel`; rollback = reverter o PR.
- Nenhum dado real é tocado sem autorização; migração de dados é *copy-forward* (Supabase preservado).

## Rollback por fase

| Fase | Reversão |
|---|---|
| B (fundação) | `git revert` do PR; remover `backend/`; produção inalterada |
| C (dados) | import vai para banco novo; descartar o banco novo; Supabase original preservado |
| D (funcionalidades) | manter React servindo a área; reverter o módulo Angular/endpoint correspondente |
| E (billing) | `BILLING_PROVIDER=fake` isola de gateways; nenhum registro Stripe/Asaas é apagado; reconciliação antes de cutover |
| G (cutover) | repontar DNS/hosting de volta ao React/Supabase; o backend novo fica inativo mas íntegro |

## Rollback de banco (backend novo)

```bash
cd backend
php artisan migrate:rollback          # reverte o último lote
# ou, em dev:
php artisan migrate:fresh --seed      # recria do zero (apenas dev)
```

## Gate de cutover (não automático)

Desativar o React só após o checklist de Definition of Done (ver `docs/qa/ACCEPTANCE_REPORT.md`) e autorização explícita. Push/merge/deploy **não** são automáticos.

## Backups

Antes de qualquer migração de dados real: backup verificado do Supabase e teste de restauração (Fase A/G). Documentar o ponto de restauração e o tempo de recuperação.
