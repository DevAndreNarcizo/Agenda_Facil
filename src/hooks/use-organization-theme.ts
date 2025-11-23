import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Hook para aplicar tema da organização automaticamente
export function useOrganizationTheme() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchAndApplyTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('primary_color, secondary_color, accent_color, logo_url')
          .eq('id', profile.organization_id)
          .single();

        if (error) {
          console.error('Error fetching theme:', error);
          return;
        }

        if (data) {
          // Aplicar cores como CSS variables no :root
          const root = document.documentElement;
          
          if (data.primary_color) {
            root.style.setProperty('--primary', data.primary_color);
          }
          
          if (data.secondary_color) {
            root.style.setProperty('--secondary', data.secondary_color);
          }
          
          if (data.accent_color) {
            root.style.setProperty('--accent', data.accent_color);
          }
        }
      } catch (err) {
        console.error('Error applying theme:', err);
      }
    };

    fetchAndApplyTheme();
  }, [profile?.organization_id]);
}
