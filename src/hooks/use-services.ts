import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
  category: string | null;
  is_active: boolean;
}

export interface ServiceInput {
  name: string;
  duration_minutes: number;
  price: number;
  description: string;
}

/**
 * Catálogo de serviços da organização com comandos de CRUD e ativação.
 * Fonte única para a tela de Serviços e para o modal de novo agendamento.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useServices() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ["services", organizationId] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price, description, category, is_active")
        .eq("organization_id", organizationId as string)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((service) => ({ ...service, is_active: service.is_active ?? true })) as Service[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  /**
   * Garante o escopo da organização em toda escrita (defesa em profundidade além do RLS).
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const requireOrganization = (): string => {
    if (!organizationId) throw new Error("Organização não encontrada.");
    return organizationId;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ServiceInput }) => {
      const orgId = requireOrganization();
      const payload = {
        name: input.name.trim(),
        duration_minutes: Number(input.duration_minutes),
        price: Number(input.price),
        description: input.description.trim() || null,
      };
      const { error } = id
        ? await supabase.from("services").update(payload).eq("id", id).eq("organization_id", orgId)
        : await supabase.from("services").insert({ ...payload, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const orgId = requireOrganization();
      const { error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id).eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const orgId = requireOrganization();
      const { error } = await supabase.from("services").delete().eq("id", id).eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    services: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    saveService: (input: ServiceInput, id?: string) => saveMutation.mutateAsync({ id, input }),
    setServiceActive: (id: string, isActive: boolean) => toggleMutation.mutateAsync({ id, isActive }),
    deleteService: deleteMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
}
