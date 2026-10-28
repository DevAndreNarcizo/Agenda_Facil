# Rollback e conservação de dados

Estado atual: somente desenvolvimento local. React/Supabase permanecem preservados, sem cutover de dados ou produção. A branch nova não recebeu commit, push, merge ou deploy automático.

A migration `400000_allow_unlimited_plan_entitlements` conserva nulabilidade no `down()` para não converter limites ilimitados em valores arbitrários nem perder dados. Portanto, `migrate:rollback` não restaura estritamente o DDL anterior. Essa alteração exige versão de código compatível ou restore autorizado do snapshot completo. O restore sintético foi executado; isso não autoriza rollback de dados reais.

## Reverter execução local

Para parar serviços sem apagar dados:

```sh
docker compose stop
```

Não usar `down -v`, migrate:fresh na base de desenvolvimento ou limpeza de diretórios como forma de rollback. O volume local contém apenas dados sintéticos, mas deve ser preservado para reprodução dos defeitos. A aplicação React continua disponível pelos scripts da raiz; depende da sua configuração Supabase legada, que não foi criada nem alterada.

O bundle `.migration-backups/pre-migration-1f99af4.bundle` conserva o histórico inicial e foi validado com `git bundle verify`. Recuperar em **novo diretório**, revisar refs e arquivos antes de qualquer substituição. Não sobrescrever alterações não commitadas do checkout atual.

## Antes de um cutover real

- Aprovação explícita do ambiente e janela; snapshot consistente de banco, objetos, referências financeiras e configuração, com manifest/checksum e armazenamento restrito.
- Restaurar em ambiente isolado e comparar schema, contagens, UUIDs, FKs, órfãos, status de agenda e saldos/histórico de cobrança. Verificar que nenhum worker/gateway envia mensagens ou cobra no restore.
- Definir fonte única de escrita durante a janela. Proibir dual-write improvisado; sincronização de volta precisa de plano e reconciliação, não de copiar tabelas indiscriminadamente.
- Conservar React e versão/schema anteriores até paridade e aceite. Password reset/revogação mudam sessões: não prometer restauração transparente de sessões antigas.

## Critérios de disparo e procedimento

Disparar rollback por perda/duplicação de reservas, isolamento entre tenants violado, pagamento ou cobrança inconsistente, indisponibilidade acima do limite operacional aprovado ou falha de integridade. Os limites numéricos e responsáveis ainda precisam de decisão operacional.

1. Bloquear novas escritas e workers da versão com defeito, preservando logs mínimos e ledger; não apagar eventos ou dados.
2. Identificar o instante do último snapshot e as escritas posteriores. Reconciliar agendamentos/pagamentos antes de voltar à fonte anterior. Cobranças existentes não devem ser recriadas ou canceladas automaticamente.
3. Restaurar banco/storage/config em alvo isolado e validar integridade; liberar somente a versão compatível com esse schema. Reverter código sem compatibilidade de banco não é recuperação completa.
4. Testar login, onboarding existente, reserva/agenda, acesso negado cruzado, exportação e estado de assinatura; verificar que só há um consumidor de webhook/worker e uma fonte de escrita.
5. Reabrir tráfego mediante aprovação responsável, monitorar e registrar divergências e reparações.

O ensaio local sintético não prova backup/rollback de produção. Supabase, Stripe e Asaas reais exigem autorização específica e reconciliação própria.
