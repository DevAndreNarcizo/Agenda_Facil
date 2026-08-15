import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PublicBookingSettingsProps = {
  organizationId: string;
  slug: string;
};

type SelectableItem = {
  id: string;
  name: string;
};

type PublicBookingSettingsState = {
  allowedEmployeeIds: string[];
  allowedServiceIds: string[];
  isEnabled: boolean;
};

const defaultSettings: PublicBookingSettingsState = {
  allowedEmployeeIds: [],
  allowedServiceIds: [],
  isEnabled: false,
};

/**
 * Alterna um identificador em uma lista sem mutar o estado atual.
 *
 * @author André Narcizo
 */
function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id];
}

/**
 * Gerencia quais itens do negócio podem ser exibidos na reserva pública.
 *
 * @author André Narcizo
 */
export function PublicBookingSettings({ organizationId, slug }: PublicBookingSettingsProps) {
  const [settings, setSettings] = useState<PublicBookingSettingsState>(defaultSettings);
  const [services, setServices] = useState<SelectableItem[]>([]);
  const [employees, setEmployees] = useState<SelectableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const bookingUrl = useMemo(() => `${window.location.origin}/reservar/${slug}`, [slug]);
  const qrUrl = useMemo(() => `${bookingUrl}?src=qr`, [bookingUrl]);
  const widgetSnippet = useMemo(
    () => `<iframe src="${bookingUrl}?src=site" title="Reserva online" width="100%" height="760" loading="lazy" style="border:0;border-radius:16px"></iframe>`,
    [bookingUrl],
  );

  useEffect(() => {
    let active = true;

    /**
     * Carrega as opções internas, protegidas pelas políticas RLS da organização.
     *
     * @author André Narcizo
     */
    const load = async (): Promise<void> => {
      const [settingsResult, servicesResult, employeesResult] = await Promise.all([
        supabase
          .from('public_booking_settings')
          .select('allowed_employee_ids, allowed_service_ids, is_enabled')
          .eq('organization_id', organizationId)
          .maybeSingle(),
        supabase
          .from('services')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', organizationId)
          .eq('role', 'employee')
          .order('full_name'),
      ]);

      if (!active) return;
      if (settingsResult.error || servicesResult.error || employeesResult.error) {
        toast.error('Não foi possível carregar as configurações de reserva pública.');
      } else {
        setSettings(settingsResult.data
          ? {
              allowedEmployeeIds: settingsResult.data.allowed_employee_ids,
              allowedServiceIds: settingsResult.data.allowed_service_ids,
              isEnabled: settingsResult.data.is_enabled,
            }
          : defaultSettings);
        setServices(servicesResult.data.map((service) => ({ id: service.id, name: service.name })));
        setEmployees(employeesResult.data.map((employee) => ({ id: employee.id, name: employee.full_name })));
      }
      setIsLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [organizationId]);

  /**
   * Copia um texto para a área de transferência sem bloquear a configuração principal.
   *
   * @author André Narcizo
   */
  const copy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  /**
   * Persiste o catálogo autorizado somente para a organização do usuário atual.
   *
   * @author André Narcizo
   */
  const save = async (): Promise<void> => {
    if (settings.isEnabled && settings.allowedServiceIds.length === 0) {
      toast.error('Selecione ao menos um serviço antes de ativar a reserva pública.');
      return;
    }
    if (settings.isEnabled && employees.length > 0 && settings.allowedEmployeeIds.length === 0) {
      toast.error('Selecione ao menos um profissional antes de ativar a reserva pública.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('public_booking_settings')
        .upsert({
          allowed_employee_ids: settings.allowedEmployeeIds,
          allowed_service_ids: settings.allowedServiceIds,
          is_enabled: settings.isEnabled,
          organization_id: organizationId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });
      if (error) throw error;
      toast.success('Reserva pública atualizada.');
    } catch {
      toast.error('Não foi possível salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-[3rem] border border-white/5 bg-stitch-surface-container-low/20 p-0 shadow-2xl">
      <CardHeader className="p-10 pb-5">
        <CardTitle className="flex items-center gap-3 text-2xl font-black">
          <span className="material-symbols-outlined text-stitch-primary">public</span>
          Reservas públicas
        </CardTitle>
        <CardDescription>Publique um link seguro sem expor dados privados do seu negócio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-10 pt-4">
        {isLoading ? <p className="text-sm text-stitch-on-surface-variant">Carregando configurações...</p> : (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-stitch-surface p-5">
              <div>
                <Label htmlFor="public-booking-enabled" className="font-black">Aceitar reservas pelo link público</Label>
                <p className="mt-1 text-xs text-stitch-on-surface-variant">Você pode desativar a qualquer momento.</p>
              </div>
              <Switch
                id="public-booking-enabled"
                checked={settings.isEnabled}
                onCheckedChange={(isEnabled) => setSettings((current) => ({ ...current, isEnabled }))}
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="font-black">Serviços exibidos</legend>
              {services.length === 0 ? <p className="text-sm text-stitch-on-surface-variant">Cadastre um serviço ativo antes de publicar.</p> : services.map((service) => (
                <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stitch-outline-variant/20 p-3">
                  <input
                    type="checkbox"
                    checked={settings.allowedServiceIds.includes(service.id)}
                    onChange={() => setSettings((current) => ({ ...current, allowedServiceIds: toggleId(current.allowedServiceIds, service.id) }))}
                  />
                  <span>{service.name}</span>
                </label>
              ))}
            </fieldset>

            {employees.length > 0 && <fieldset className="space-y-3">
              <legend className="font-black">Profissionais exibidos</legend>
              {employees.map((employee) => (
                <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stitch-outline-variant/20 p-3">
                  <input
                    type="checkbox"
                    checked={settings.allowedEmployeeIds.includes(employee.id)}
                    onChange={() => setSettings((current) => ({ ...current, allowedEmployeeIds: toggleId(current.allowedEmployeeIds, employee.id) }))}
                  />
                  <span>{employee.name}</span>
                </label>
              ))}
            </fieldset>}

            <Button className="w-full" onClick={() => void save()} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar reservas públicas'}
            </Button>

            <div className="space-y-4 border-t border-stitch-outline-variant/20 pt-7">
              <div className="space-y-2">
                <Label>Link de reserva</Label>
                <div className="flex gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-stitch-surface p-3 text-xs">{bookingUrl}</code><Button variant="outline" onClick={() => void copy(bookingUrl)}>Copiar</Button></div>
              </div>
              <div className="space-y-2">
                <Label>Destino do QR Code (origem rastreada)</Label>
                <div className="flex gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-stitch-surface p-3 text-xs">{qrUrl}</code><Button variant="outline" onClick={() => void copy(qrUrl)}>Copiar</Button></div>
              </div>
              <div className="space-y-2">
                <Label>Widget para site</Label>
                <div className="flex gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-stitch-surface p-3 text-xs">{widgetSnippet}</code><Button variant="outline" onClick={() => void copy(widgetSnippet)}>Copiar</Button></div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
