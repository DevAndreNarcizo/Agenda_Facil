type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const missingRelationCodes = new Set(["42P01", "PGRST116", "PGRST205"]);

/**
 * Identifica erros de tabela/relacionamento ausente no Supabase/PostgREST.
 *
 * @author André Narcizo
 */
export function isMissingRelationError(error: unknown) {
  const supabaseError = error as SupabaseLikeError | null;
  const message = supabaseError?.message?.toLowerCase() || "";

  return (
    Boolean(supabaseError?.code && missingRelationCodes.has(supabaseError.code)) ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("not found")
  );
}

/**
 * Converte erros técnicos do Supabase em mensagens acionáveis para a UI.
 *
 * @author André Narcizo
 */
export function getSupabaseErrorMessage(error: unknown, fallback = "Erro ao processar solicitação.") {
  const supabaseError = error as SupabaseLikeError | null;
  const message = supabaseError?.message || "";

  if (isMissingRelationError(error)) {
    return "A tabela de clientes ainda não existe no Supabase. Execute a migration 20260428_create_customers_table.sql.";
  }

  if (supabaseError?.code === "23505") {
    return "Já existe um cadastro com esses dados.";
  }

  if (supabaseError?.code === "23503") {
    return "Registro vinculado a dados inexistentes. Atualize a página e tente novamente.";
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "Sem permissão para salvar este registro. Verifique login, organização e políticas RLS.";
  }

  return message || fallback;
}
