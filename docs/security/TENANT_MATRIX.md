# Matriz de isolamento e autorização

Contexto: Laravel local, UUIDs, sessão Sanctum e membership ativa revalidada em cada request. O tenant não vem de header ou payload. Todas as consultas de domínio precisam incluir `organization_id`; um UUID desconhecido ou de outra organização retorna404, sem confirmar sua existência. Referências: ADR-010, SPEC-001 e SPEC-017.

| Recurso/ação | Owner | Admin | Employee | Cliente portal | Público |
|---|---|---|---|---|---|
| Ler catálogo/agenda do tenant | Sim | Sim | Sim | Catálogo mínimo/agenda do email comprovado | Catálogo mínimo/slots sem dados pessoais |
| Criar/editar/desativar serviço/profissional | Sim | Sim | Não | Não | Não |
| Criar/editar clientes; excluir sem histórico | Sim | Sim | Criar/editar no tenant; exclusão negada | Somente cadastro próprio associado à reserva | Cadastro mínimo novo na reserva |
| Criar/reagendar/transicionar atendimento | Sim | Sim | Só profissional vinculado à sua membership | Reservar/cancelar próprios, sem tenant/preço/status livres | Reservar; cancelar com segredo da confirmação |
| Bloqueios de agenda | Todos | Todos | Só próprio profissional; sem bloqueio global | Não | Não |
| Configuração/marca/expediente | Sim | Sim | Leitura | Não | Somente marca pública autorizada |
| Upload/delete arquivo privado | Sim | Sim | Não | Não | Não |
| Download de arquivo privado | Tenant | Tenant | Tenant | Não | Não |
| Convites/administração de memberships | Sim | Sim, sem promover/remover owner | Não | Não | Não |
| Transferir propriedade | Sim, transação segura | Não | Não | Não | Não |
| Remover último owner | Não | Não | Não | Não | Não |
| Checkout/troca/cancelamento/faturas | Sim | Não | Não | Não | Não |
| Resumo assinatura | Sim | Sim | Sim | Não | Catálogo sem estado privado |
| Exportação administrativa | Sim | Sim | Não | Acesso aos próprios atendimentos; exportação formal pendente | Não |

O código e os testes prevalecem sobre a matriz se houver divergência: divergência é defeito/documentação pendente, não permissão implícita. Casos efetivamente executados e resultados estão no relatório de aceite.

## Defesas implementadas e verificáveis

- Sessão de usuário e portal são independentes, cookies HttpOnly; CSRF inclusive login/reserva pública/portal. O webhook Asaas é a exceção explícita e exige token próprio validado em tempo constante e confirmação do recurso no provedor.
- Portal usa token de login com hash, TTL15min e consumo sob lock; sessão de 2h revogável. Email comprovado só concede acesso aos registros desse mesmo email dentro do tenant. Alteração do email invalida token/sessão. O token vem no fragmento da URL, removido pela SPA.
- Tenant FKs compostas impedem misturar serviço/profissional/cliente de organizações diferentes. Exclusão GiST e lock transacional cobrem agendamentos; bloqueios usam o mesmo lock. Cotas usam lock na assinatura e contador transacional.
- Profissional é entidade separada de conta; vínculo de membership não pode apontar para outra organização. Convites têm hash, TTL e aceite pelo email autenticado. Revogação bloqueia o próximo request; transferência e último owner são protegidos por lock.
- Arquivos têm prefixo tenant/UUID gerado pelo servidor, metadata scoped, validação MIME/tamanho e ACL privada; produção exige driverS3. Não há URL pública nem path livre. S3 externo ainda requer homologação.
- Cache e sessão do novo monólito usam PostgreSQL no ambiente local; chaves de rate limit incluem IP e identificador hash quando aplicável. Novas chaves de dados de tenant devem conter UUID e versão. Jobs futuros devem levar tenant explícito e revalidar estado; ainda não existe worker de mensagens habilitado.
- Logs/audit guardam IDs, ação e códigos; não armazenar senhas, tokens, OTP, documento, email/telefone ou payload bruto de gateway. Mailpit contém somente mensagens sintéticas e não deve existir em produção.
- Exceções de banco são reportadas sem SQL/bindings nem mensagem original: somente SQLSTATE validado e padrão estático da rota. Uma regressão verifica que dados sentinela não entram no log padrão; a suíte completa passou após a proteção.

## RLS adicional — estratégia pendente de ativação

O usuário local do PostgreSQL é dono do banco para migrations/testes. **Não prova RLS de produção.** A autorização principal é Laravel; não declarar que RLS já está ativada na nova API.

Antes de staging: separar role de migrations da role de runtime sem SUPERUSER/BYPASSRLS e sem ownership das tabelas; aplicar RLS/FORCE RLS por tenant; executar `SET LOCAL app.organization_id` dentro da transação após resolver membership; policies exigem esse contexto e negam ausência. Jobs/importações usam papéis e caminhos administrativos delimitados. Testar pool/reuso de conexão, rollback e reset de contexto, consultas de bootstrap e isolamento negativo com duas organizações. RLS nunca deve confiar em header ou claim editável.

## LGPD, retenção e exportação

O MVP não inclui prontuário nem coleta clínica. Cadastro público é mínimo; os testes são sintéticos. Exportação administrativa está implementada, mas workflow formal de atendimento a titular, identificação, retenção por categoria, descarte de backups, política contratual e tratamento de pedidos de exclusão precisam de decisão aprovada antes de dados reais. Não executar purge de domínio sem essa política. Tokens/sessões têm validade operacional definida; job de limpeza física e métricas de retenção permanecem pendentes. Revisão jurídica e encarregado não são substituídos por esta matriz.
