import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface WaitlistEntry {
  id: string;
  customer_id: string;
  service_id?: string;
  employee_id?: string;
  desired_date: string;
  notes?: string;
  status: "pending" | "contacted" | "scheduled" | "cancelled";
  created_at: string;
  customer?: {
    name: string;
    phone: string;
  };
  service?: {
    name: string;
  };
  employee?: {
    full_name: string;
  };
}

export function useWaitlist() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: waitlist = [], isLoading: loading } = useQuery({
    queryKey: ["waitlist", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from("waitlist")
        .select(`
          *,
          customer:customers(name, phone),
          service:services(name),
          employee:profiles(full_name)
        `)
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map single objects from arrays if necessary
      return data.map((item: any) => ({
        ...item,
        customer: Array.isArray(item.customer) ? item.customer[0] : item.customer,
        service: Array.isArray(item.service) ? item.service[0] : item.service,
        employee: Array.isArray(item.employee) ? item.employee[0] : item.employee
      })) as WaitlistEntry[];
    },
    enabled: !!profile?.organization_id,
  });

  const addToWaitlist = useMutation({
    mutationFn: async (entry: Omit<WaitlistEntry, "id" | "created_at" | "customer" | "service" | "employee">) => {
      const { data, error } = await supabase
        .from("waitlist")
        .insert({
          ...entry,
          organization_id: profile?.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", profile?.organization_id] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WaitlistEntry["status"] }) => {
      const { error } = await supabase
        .from("waitlist")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", profile?.organization_id] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("waitlist")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", profile?.organization_id] });
    },
  });

  return {
    waitlist,
    loading,
    addToWaitlist: addToWaitlist.mutateAsync,
    updateStatus: updateStatus.mutateAsync,
    deleteEntry: deleteEntry.mutateAsync,
  };
}
