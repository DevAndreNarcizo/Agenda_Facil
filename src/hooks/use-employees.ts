import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export interface Employee {
  id: string;
  full_name: string;
  email?: string | null;
  role: "admin" | "owner" | "employee" | "staff";
  created_at?: string;
  organization_id?: string;
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
        .select("id, full_name, email, role, created_at, organization_id")
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

      const { data: createdEmployee, error } = await supabase.functions.invoke('create-employee', {
        body: {
          fullName: data.fullName,
          email: data.email,
          password: data.password,
          role: data.role || 'employee',
        },
      });

      if (error) {
        throw new Error(error.message || 'Não foi possível criar a conta do profissional.');
      }

      return createdEmployee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", profile?.organization_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { full_name?: string; role?: Employee["role"] } }) => {
      const organizationId = profile?.organization_id;
      if (!organizationId) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", profile?.organization_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const organizationId = profile?.organization_id;
      if (!organizationId) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id)
        .eq('organization_id', organizationId);
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
