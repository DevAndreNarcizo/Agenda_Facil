import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export function useAvailability() {
  const { profile } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkAvailability = async (
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
    employeeId?: string
  ): Promise<boolean> => {
    if (!profile?.organization_id) return false;

    setChecking(true);
    try {
      let query = supabase
        .from("appointments")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .neq("status", "cancelled")
        // Logic: An existing appointment overlaps if its start is before the new end
        // AND its end is after the new start.
        .lt("start_time", endTime)
        .gt("end_time", startTime);

      if (excludeAppointmentId) {
        query = query.neq("id", excludeAppointmentId);
      }

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // If any rows are returned, there is a conflict
      return data.length === 0;
    } catch (error) {
      console.error("Error checking availability:", error);
      return false; // Assume unavailable on error to be safe
    } finally {
      setChecking(false);
    }
  };

  return {
    checkAvailability,
    checking,
  };
}
