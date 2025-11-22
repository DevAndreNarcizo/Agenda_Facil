import { createClient } from '@supabase/supabase-js';

// Carrega as variáveis de ambiente definidas no arquivo .env
// VITE_SUPABASE_URL: URL do seu projeto Supabase
// VITE_SUPABASE_ANON_KEY: Chave pública anônima (segura para usar no frontend)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação de segurança: Garante que as variáveis existem antes de tentar conectar
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Cria e exporta uma instância única do cliente Supabase
// Esta instância será usada em toda a aplicação para fazer requisições ao banco de dados e auth
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
