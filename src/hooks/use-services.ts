import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category?: string;
  organization_id: string;
}

export function useServices() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: services = [], isLoading: loading, error } = useQuery({
    queryKey: ["services", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("name");

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!profile?.organization_id,
  });

  const createMutation = useMutation({
    mutationFn: async (service: Omit<Service, "id" | "organization_id">) => {
      const { data, error } = await supabase
        .from("services")
        .insert({
          ...service,
          organization_id: profile?.organization_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", profile?.organization_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Service, "id" | "organization_id">> }) => {
      const { data, error } = await supabase
        .from("services")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", profile?.organization_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", profile?.organization_id] });
    },
  });

  return {
    services,
    loading,
    error: error ? (error as Error).message : null,
    createService: (service: Omit<Service, "id" | "organization_id">) => createMutation.mutateAsync(service),
    updateService: (id: string, updates: Partial<Omit<Service, "id" | "organization_id">>) => updateMutation.mutateAsync({ id, updates }),
    deleteService: (id: string) => deleteMutation.mutateAsync(id),
  };
}
