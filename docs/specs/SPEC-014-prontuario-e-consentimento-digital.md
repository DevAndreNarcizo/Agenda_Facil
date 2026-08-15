# SPEC-014 — Prontuário, formulários e consentimento digital

**Status:** proposta
**Prioridade:** P2 — habilitar somente para verticais de saúde/estética
**Dependências:** SPEC-001, SPEC-002 e SPEC-004

## Objetivo
Oferecer fichas de anamnese, consentimentos e registros de atendimento com controle de acesso e trilha de auditoria.

## Escopo
- construtor de formulários por organização;
- preenchimento pré-atendimento pelo portal;
- consentimento com versão do termo, data, IP minimizado e assinatura;
- prontuário com notas, fotos/documentos opcionais e histórico;
- permissões específicas por papel e retenção configurável.

## Fora do escopo
Diagnóstico médico, prescrição, integração com prontuários hospitalares ou interpretação clínica automatizada.

## Requisitos funcionais
1. Dados sensíveis recebem RLS restritiva, auditoria e acesso mínimo necessário.
2. Respostas são versionadas; atualizar formulário não altera resposta antiga.
3. Cliente acessa somente seus próprios documentos quando essa opção estiver habilitada.
4. Uploads devem usar bucket privado, URL temporária e validação de tipo/tamanho.

## Critérios de aceite
- [ ] Usuário de outra organização não lê metadados nem arquivos.
- [ ] Consentimento registra a versão exata aceita.
- [ ] Profissional não autorizado não acessa prontuário restrito.
- [ ] Exclusão/retencão segue política da organização e é auditável.
