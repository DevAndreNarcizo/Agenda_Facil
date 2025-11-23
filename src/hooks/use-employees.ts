import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface Employee {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "owner" | "employee" | "staff";
}

export function useEmployees() {
  const { profile } = useAuth();

  const { data: employees = [], isLoading: loading } = useQuery({
    queryKey: ["employees", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      // Fetch profiles that belong to the same organization
      // Note: This assumes RLS policies allow viewing other profiles in the same org
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role") // email might be in auth.users, not profiles, depending on schema. Let's stick to profiles cols.
        .eq("organization_id", profile.organization_id)
        .order("full_name");

      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!profile?.organization_id,
  });

  return { employees, loading };
}
