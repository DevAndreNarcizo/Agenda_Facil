import { useEffect, useMemo, useState } from 'react';
import { PublicBookingQrCode } from '@/components/dashboard/settings/public-booking-qr-code';
import { Icon, Panel, PanelButton, PanelSwitch, Skeleton } from '@/components/panel/primitives';
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
 * Gera o iframe seguro e pronto para colar no site parceiro.
 *
 * @author André Narcizo
 */
function createPublicBookingWidgetSnippet(bookingUrl: string): string {
  return `<iframe src="${bookingUrl}?src=site" title="Reserva online" width="100%" height="760" loading="lazy" style="border:0;border-radius:16px"></iframe>`;
}

/**
 * Alterna um identificador em uma lista sem mutar o estado atual.
 *
 * @author André Narcizo
 */
function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id];
}

/**
 * Lista de itens com switch (serviços/profissionais exibidos na reserva pública).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function ToggleList({ title, items, selected, onToggle, empty }: {
  title: string;
  items: SelectableItem[];
  selected: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-af-line px-5 py-3">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="text-xs text-af-ink3">{selected.filter((id) => items.some((item) => item.id === id)).length} de {items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="m-0 px-5 py-3.5 text-[13px] text-af-ink2">{empty}</p>
      ) : items.map((item) => (
        <label key={item.id} className="flex cursor-pointer items-center gap-4 border-t border-af-line px-5 py-3 first-of-type:border-t-0">
          <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
          <PanelSwitch checked={selected.includes(item.id)} onCheckedChange={() => onToggle(item.id)} aria-label={`Exibir ${item.name}`} />
        </label>
      ))}
    </Panel>
  );
}

/**
 * Gerencia quais itens do negócio podem ser exibidos na reserva pública,
 * além do link, QR code e widget para site.
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
    () => createPublicBookingWidgetSnippet(bookingUrl),
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
      toast.success('Reserva online atualizada.');
    } catch {
      toast.error('Não foi possível salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-[320px]" />;

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-wrap items-center gap-4 px-5 py-4">
        <PublicBookingQrCode value={qrUrl} size={72} />
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs text-af-ink3">Seu link</span>
          <span className="break-all text-sm font-medium">{bookingUrl.replace(/^https?:\/\//, '')}</span>
          <span className="text-xs text-af-ink3">Reservas abertas pelo QR code são marcadas com a origem “QR Code”.</span>
        </div>
        <div className="flex gap-2">
          <PanelButton icon="content_copy" onClick={() => void copy(bookingUrl)}>Copiar</PanelButton>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-af-line2 bg-af-surface px-3 text-[13px] font-medium text-af-ink no-underline hover:bg-af-surface2">
            <Icon name="open_in_new" size={17} />Abrir
          </a>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <label className="flex cursor-pointer items-center gap-4 px-5 py-3.5">
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-sm font-medium">Reserva online ativa</span>
            <span className="text-xs text-af-ink3 [text-wrap:pretty]">Clientes podem reservar pelo link público, pelo QR code e pelo widget.</span>
          </span>
          <PanelSwitch checked={settings.isEnabled} onCheckedChange={(isEnabled) => setSettings((current) => ({ ...current, isEnabled }))} aria-label="Reserva online ativa" />
        </label>
      </Panel>

      <ToggleList
        title="Serviços exibidos"
        items={services}
        selected={settings.allowedServiceIds}
        onToggle={(id) => setSettings((current) => ({ ...current, allowedServiceIds: toggleId(current.allowedServiceIds, id) }))}
        empty="Cadastre um serviço ativo antes de publicar."
      />

      {employees.length > 0 && (
        <ToggleList
          title="Profissionais exibidos"
          items={employees}
          selected={settings.allowedEmployeeIds}
          onToggle={(id) => setSettings((current) => ({ ...current, allowedEmployeeIds: toggleId(current.allowedEmployeeIds, id) }))}
          empty=""
        />
      )}

      <div className="flex justify-end">
        <PanelButton variant="primary" size="md" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? 'Salvando…' : 'Salvar reserva online'}
        </PanelButton>
      </div>

      <Panel className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Widget para site</span>
          <span className="text-xs text-af-ink3">Cole este código HTML na página em que deseja exibir o agendamento.</span>
        </div>
        <textarea
          aria-label="Código HTML do widget de reserva"
          className="af-input min-h-24 resize-none py-2.5 font-mono text-xs"
          readOnly
          value={widgetSnippet}
        />
        <div><PanelButton icon="content_copy" onClick={() => void copy(widgetSnippet)}>Copiar código</PanelButton></div>
      </Panel>
    </div>
  );
}
