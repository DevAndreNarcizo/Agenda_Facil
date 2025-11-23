import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface Promotion {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  service_id: string | null;
  created_at: string;
  service?: {
    name: string;
  };
}

export interface CreatePromotionData {
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string;
  end_date?: string;
  service_id?: string | null;
}

export function usePromotions() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: promotions, isLoading, error } = useQuery({
    queryKey: ["promotions", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from("promotions")
        .select(`
          *,
          service:services(name)
        `)
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return data.map((item: any) => ({
        ...item,
        service: Array.isArray(item.service) ? item.service[0] : item.service
      })) as Promotion[];
    },
    enabled: !!profile?.organization_id,
  });

  const createPromotionMutation = useMutation({
    mutationFn: async (newPromotion: CreatePromotionData) => {
      if (!profile?.organization_id) throw new Error("No organization ID");

      const { data, error } = await supabase
        .from("promotions")
        .insert([{ ...newPromotion, organization_id: profile.organization_id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions", profile?.organization_id] });
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("promotions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions", profile?.organization_id] });
    },
  });

  const togglePromotionStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("promotions")
        .update({ active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions", profile?.organization_id] });
    },
  });

  return {
    promotions,
    isLoading,
    error,
    createPromotion: createPromotionMutation.mutateAsync,
    deletePromotion: deletePromotionMutation.mutateAsync,
    togglePromotionStatus: togglePromotionStatusMutation.mutateAsync,
  };
}
