import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

interface Employee {
  id: string;
  full_name: string;
  email?: string;
  role: "admin" | "owner" | "employee" | "staff";
  created_at?: string;
  organization_id?: string;
}

// Client separado para signup (criado uma vez, sem persistência de sessão)
let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
  }
  return adminClient;
}

export function useEmployees() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading: loading, error } = useQuery({
    queryKey: ["employees", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, created_at, organization_id")
        .eq("organization_id", profile.organization_id)
        .order("full_name");

      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!profile?.organization_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { fullName: string; email: string; password: string; role?: Employee["role"] }) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const tempSupabase = getAdminClient();

      // 1. Criar usuário no auth
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.fullName } },
      });

      if (authError) {
        if (authError.message?.includes("already") || authError.message?.includes("registered") || authError.status === 422 || authError.status === 400) {
          throw new Error("Este email já está cadastrado no sistema. Use outro email.");
        }
        throw new Error(authError.message || "Erro ao criar conta do profissional.");
      }

      if (!authData.user) throw new Error("Erro ao criar usuário");

      // Verificar se o signup retornou um user "fake" (email já existe com confirm habilitado)
      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error("Este email já está cadastrado no sistema. Use outro email.");
      }

      // 2. Atualizar perfil usando o tempSupabase (autenticado como o novo user)
      // Isso passa pela policy "id = auth.uid()" pois o tempSupabase tem sessão do novo user
      const { error: profileError } = await tempSupabase
        .from("profiles")
        .update({
          organization_id: profile.organization_id,
          full_name: data.fullName,
          role: data.role || "employee",
        })
        .eq("id", authData.user.id);

      // Se update falhar (profile ainda não criado pelo trigger), tentar insert
      if (profileError) {
        const { error: insertError } = await tempSupabase
          .from("profiles")
          .insert({
            id: authData.user.id,
            organization_id: profile.organization_id,
            full_name: data.fullName,
            role: data.role || "employee",
          });

        if (insertError) throw new Error("Conta criada mas erro ao vincular à organização: " + insertError.message);
      }

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", profile?.organization_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { full_name?: string; role?: Employee["role"] } }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", profile?.organization_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", profile?.organization_id] });
    },
  });

  return {
    employees,
    loading,
    error: error ? (error as Error).message : null,
    createEmployee: createMutation.mutateAsync,
    updateEmployee: (id: string, updates: { full_name?: string; role?: Employee["role"] }) => updateMutation.mutateAsync({ id, updates }),
    deleteEmployee: (id: string) => deleteMutation.mutateAsync(id),
  };
}
