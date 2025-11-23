# Migrações de Banco de Dados

Este diretório contém as migrações SQL que precisam ser aplicadas ao banco de dados Supabase.

## Como Aplicar as Migrações

### Opção 1: Via Dashboard do Supabase (Recomendado)

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie e cole o conteúdo de cada arquivo `.sql` na ordem:
   - `01_otp_system.sql`
   - `02_prevent_double_booking.sql`
6. Clique em **Run** para executar

### Opção 2: Via Supabase CLI

```bash
# Certifique-se de ter o Supabase CLI instalado
npm install -g supabase

# Faça login
supabase login

# Link com seu projeto
supabase link --project-ref SEU_PROJECT_REF

# Aplique as migrações
supabase db push
```

## Descrição das Migrações

### 01_otp_system.sql

**Objetivo**: Implementar sistema de autenticação segura via OTP (One-Time Password)

**O que faz**:

- Cria tabela `verification_codes` para armazenar códigos temporários
- Cria função `request_otp()` para gerar códigos de 6 dígitos
- Cria função `verify_otp()` para validar códigos
- Códigos expiram em 5 minutos

**Segurança**:

- Códigos são consumidos após uso (deletados)
- Validação de expiração automática
- Em produção, integrar com WhatsApp Business API para envio real

### 02_prevent_double_booking.sql

**Objetivo**: Prevenir agendamentos duplicados (double booking)

**O que faz**:

- Habilita extensão `btree_gist` para constraints avançadas
- Adiciona constraint de exclusão que impede sobreposição de horários
- Funciona tanto para agendamentos com profissional específico quanto sem
- Cria índices para melhorar performance

**Importante**:

- Esta constraint funciona no nível do banco de dados
- Mesmo que dois usuários tentem agendar simultaneamente, apenas um será aceito
- O outro receberá um erro que deve ser tratado no frontend

## Verificação

Após aplicar as migrações, você pode verificar se foram aplicadas corretamente:

```sql
-- Verificar se a tabela foi criada
SELECT * FROM verification_codes LIMIT 1;

-- Verificar se as funções existem
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('request_otp', 'verify_otp');

-- Verificar constraints
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'appointments'::regclass;
```

## Rollback

Se precisar reverter as migrações:

```sql
-- Reverter 02_prevent_double_booking.sql
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlapping_appointments_per_employee;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlapping_appointments_organization;
DROP INDEX IF EXISTS idx_appointments_time_range;

-- Reverter 01_otp_system.sql
DROP FUNCTION IF EXISTS verify_otp(TEXT, TEXT);
DROP FUNCTION IF EXISTS request_otp(TEXT);
DROP TABLE IF EXISTS verification_codes;
```
