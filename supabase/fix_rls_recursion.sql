-- ====== CORREÇÃO DE LOOP INFINITO NO SUPABASE (RLS) - Versão 2 ======
-- Este script corrige o erro de "infinite recursion" usando o nome real 
-- da coluna detectada no seu banco: "organization_id".

-- 1. Cria uma função segura (SECURITY DEFINER) para pegar a organização do usuário logado:
-- Usamos "organization_id" que é o nome real da coluna na sua tabela "profiles"
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- 2. Recria as Políticas de Segurança (Substituindo as que estão em loop)
-- Removendo as políticas antigas que causam o erro 500
DROP POLICY IF EXISTS "Usuários podem ver perfis da sua própria empresa" ON profiles;
DROP POLICY IF EXISTS "Usuários podem ver perfis" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in own company" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in own organization" ON profiles;

-- Criando a nova política corrigida para LEITURA
CREATE POLICY "Usuários podem ver perfis da sua própria organização"
ON profiles FOR SELECT
USING (
  id = auth.uid() OR organization_id = get_user_organization_id()
);

-- Criando a nova política corrigida para EDIÇÃO
CREATE POLICY "Usuários podem editar perfis na sua organização"
ON profiles FOR UPDATE
USING (
  id = auth.uid() OR (
    role = 'admin' AND organization_id = get_user_organization_id()
  )
);

-- IMPORTANTE: Vá no seu painel Supabase > SQL Editor > Cole isso lá e clique em "Run".
-- Lembre-se de selecionar as linhas da consulta ou apagar o que já estava no editor.
