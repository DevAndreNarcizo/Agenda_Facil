import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { applyOrganizationBrandTheme } from '@/lib/theme';

// Hook para aplicar tema da organização automaticamente
export function useOrganizationTheme() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchAndApplyTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select('primary_color, secondary_color, accent_color, logo_url')
          .eq('id', profile.organization_id)
          .single();

        if (error) return;

        if (data) {
          applyOrganizationBrandTheme({
            primaryColor: data.primary_color,
            secondaryColor: data.secondary_color,
            accentColor: data.accent_color,
          });
        }
      } catch {
        // Theme application failed silently
      }
    };

    fetchAndApplyTheme();
  }, [profile?.organization_id]);
}
