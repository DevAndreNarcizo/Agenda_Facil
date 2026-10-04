import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessHours, type BusinessDay } from "@/hooks/use-business-hours";
import { describeError, useOrganization } from "@/hooks/use-organization";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { PublicBookingSettings } from "@/components/dashboard/settings/public-booking-settings";
import {
  Field, Page, PageHeader, Panel, PanelButton, PanelSwitch, Segmented, SettingsSection, Skeleton,
} from "@/components/panel/primitives";
import { formatMinutes, timeToMinutes } from "@/lib/agenda-time";
import { cn } from "@/lib/utils";

type TabId = "profile" | "look" | "booking" | "billing";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Perfil geral" },
  { id: "look", label: "Aparência" },
  { id: "booking", label: "Reserva online" },
  { id: "billing", label: "Plano e faturas" },
];

const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
/** Ordem de exibição: segunda → domingo. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const BRAND_SWATCHES = [
  { name: "Azul AgendaFácil", hex: "#087bf5" },
  { name: "Navy", hex: "#092343" },
  { name: "Beleza", hex: "#f04f7d" },
  { name: "Bem-estar", hex: "#7040e8" },
  { name: "Pet", hex: "#27ad59" },
  { name: "Grafite", hex: "#334155" },
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface ProfileForm {
  name: string;
  slug: string;
  specialty: string;
  instagram: string;
  address: string;
  number: string;
  city: string;
  state: string;
  cep: string;
}

/**
 * Lê um campo textual do JSON de endereço salvo no onboarding.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function addressField(address: unknown, key: string): string {
  if (address && typeof address === "object" && !Array.isArray(address)) {
    const value = (address as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  }
  return "";
}

/**
 * Aba Perfil geral: dados do negócio (organizations + organization_settings) e horário de funcionamento.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function ProfileTab() {
  const { organization, settings, loading, updateOrganization, saving } = useOrganization();
  const { days, loading: loadingHours, saveBusinessHours, saving: savingHours } = useBusinessHours();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [schedule, setSchedule] = useState<BusinessDay[] | null>(null);

  // Inicializa os formulários quando os dados chegam (e após salvar/descartar).
  const initialForm: ProfileForm | null = organization
    ? {
        name: organization.name,
        slug: organization.slug ?? "",
        specialty: settings?.specialty ?? "",
        instagram: settings?.instagram ?? "",
        address: addressField(settings?.address, "address"),
        number: addressField(settings?.address, "number"),
        city: addressField(settings?.address, "city"),
        state: addressField(settings?.address, "state"),
        cep: addressField(settings?.address, "cep"),
      }
    : null;
  const current = form ?? initialForm;
  const currentSchedule = schedule ?? days;
  const update = (patch: Partial<ProfileForm>) => current && setForm({ ...current, ...patch });
  const slugValid = !current || SLUG_PATTERN.test(current.slug);

  /**
   * Salva identidade, link e endereço em uma única ação.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const saveProfile = async () => {
    if (!current || !slugValid || current.name.trim().length < 2) return;
    try {
      await updateOrganization({
        organization: { name: current.name.trim(), slug: current.slug },
        settings: {
          specialty: current.specialty.trim(),
          instagram: current.instagram.trim(),
          address: { address: current.address.trim(), number: current.number.trim(), city: current.city.trim(), state: current.state.trim(), cep: current.cep.trim() },
        },
      });
      setForm(null);
      toast.success("Dados do negócio salvos.");
    } catch (cause) {
      const message = cause instanceof Error && /duplicate|unique/i.test(cause.message) ? "Esse link já está em uso. Escolha outro." : describeError(cause, "Não foi possível salvar os dados.");
      toast.error(message);
    }
  };

  const saveSchedule = async () => {
    try {
      await saveBusinessHours(currentSchedule);
      setSchedule(null);
      toast.success("Horário de funcionamento salvo.");
    } catch (cause) {
      toast.error(describeError(cause, cause instanceof Error ? cause.message : "Não foi possível salvar o horário."));
    }
  };

  const updateDay = (dayOfWeek: number, patch: Partial<BusinessDay>) =>
    setSchedule(currentSchedule.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));

  if (loading || !current) return <Skeleton className="h-[420px]" />;

  const text = (key: keyof ProfileForm, label: string, options: { span?: boolean; placeholder?: string; hint?: string; maxLength?: number } = {}) => (
    <Field label={label} htmlFor={`org-${key}`} hint={options.hint} className={options.span ? "col-span-full" : undefined}>
      <input id={`org-${key}`} className="af-input" maxLength={options.maxLength ?? 160} placeholder={options.placeholder} value={current[key]} onChange={(event) => update({ [key]: event.target.value })} />
    </Field>
  );

  return (
    <>
      <SettingsSection title="Dados do negócio" description="Como seus clientes identificam sua marca na reserva online e nas mensagens.">
        <Panel>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-[18px] p-5">
            {text("name", "Nome comercial", { placeholder: "Ex.: Studio Lumière" })}
            {text("specialty", "Especialidade", { placeholder: "Ex.: Estética facial", maxLength: 120 })}
            <Field
              label="Link de reserva"
              htmlFor="org-slug"
              className="col-span-full"
              error={slugValid ? undefined : "Use letras minúsculas, números e hífens (ex.: studio-lumiere)."}
              hint="Usado no link de reserva e no QR code. Alterar quebra links já divulgados."
            >
              <div className="flex h-[38px] items-center overflow-hidden rounded-lg border border-af-line2 bg-af-bg text-sm focus-within:border-af-accent">
                <span className="flex h-full items-center whitespace-nowrap border-r border-af-line bg-af-surface2 px-2.5 text-af-ink3">{window.location.host}/reservar/</span>
                <input id="org-slug" className="h-full min-w-0 flex-1 bg-transparent px-3 text-af-ink outline-none" value={current.slug} onChange={(event) => update({ slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} />
              </div>
            </Field>
            {text("instagram", "Instagram", { placeholder: "@seuperfil", maxLength: 100 })}
            {text("cep", "CEP", { placeholder: "00000-000", maxLength: 20 })}
            {text("address", "Endereço", { span: true, placeholder: "Rua, bairro" })}
            {text("number", "Número", { maxLength: 20 })}
            {text("city", "Cidade", { maxLength: 100 })}
            {text("state", "Estado", { maxLength: 50 })}
            <Field label="Fuso horário" hint="A agenda opera no horário de Brasília.">
              <div className="flex h-[38px] items-center rounded-lg border border-af-line bg-af-surface2 px-3 text-sm text-af-ink2">America/Sao_Paulo (GMT−3)</div>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-af-line px-5 py-3.5">
            <PanelButton variant="ghost" size="md" disabled={!form} onClick={() => setForm(null)}>Descartar</PanelButton>
            <PanelButton variant="primary" size="md" disabled={!form || !slugValid || saving} onClick={() => void saveProfile()}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </PanelButton>
          </div>
        </Panel>
      </SettingsSection>

      <div className="h-px bg-af-line" />

      <SettingsSection title="Horário de funcionamento" description="Define os horários disponíveis para reserva e a janela exibida na Agenda.">
        {loadingHours ? <Skeleton className="h-[340px]" /> : (
          <Panel className="overflow-hidden">
            {WEEK_ORDER.map((dayOfWeek) => {
              const day = currentSchedule.find((entry) => entry.dayOfWeek === dayOfWeek)!;
              const invalid = day.isActive && day.end <= day.start;
              return (
                <div key={dayOfWeek} className="grid grid-cols-[minmax(110px,1fr)_44px_minmax(0,1.4fr)] items-center gap-4 border-t border-af-line px-5 py-2.5 first:border-t-0">
                  <span className={cn("text-sm", day.isActive ? "text-af-ink" : "text-af-ink3")}>{WEEKDAY_LABELS[dayOfWeek]}</span>
                  <PanelSwitch checked={day.isActive} onCheckedChange={(isActive) => updateDay(dayOfWeek, { isActive })} aria-label={`Aberto ${WEEKDAY_LABELS[dayOfWeek]}`} />
                  {day.isActive ? (
                    <span className="flex items-center gap-2 text-[13px] text-af-ink2">
                      <input type="time" step={1800} aria-label={`Abertura ${WEEKDAY_LABELS[dayOfWeek]}`} className="af-input h-8 w-[124px] px-2" value={formatMinutes(day.start)} onChange={(event) => event.target.value && updateDay(dayOfWeek, { start: timeToMinutes(event.target.value) })} />
                      –
                      <input type="time" step={1800} aria-label={`Fechamento ${WEEKDAY_LABELS[dayOfWeek]}`} aria-invalid={invalid} className={cn("af-input h-8 w-[124px] px-2", invalid && "border-af-bad")} value={formatMinutes(day.end)} onChange={(event) => event.target.value && updateDay(dayOfWeek, { end: timeToMinutes(event.target.value) })} />
                    </span>
                  ) : (
                    <span className="text-[13px] text-af-ink3">Fechado</span>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 border-t border-af-line px-5 py-3.5">
              <PanelButton variant="ghost" size="md" disabled={!schedule} onClick={() => setSchedule(null)}>Descartar</PanelButton>
              <PanelButton variant="primary" size="md" disabled={!schedule || savingHours} onClick={() => void saveSchedule()}>
                {savingHours ? "Salvando…" : "Salvar horário"}
              </PanelButton>
            </div>
          </Panel>
        )}
      </SettingsSection>
    </>
  );
}

/**
 * Aba Aparência: logo, cor da marca (aplicada na reserva e no portal) e tema do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function AppearanceTab() {
  const { organization, updateOrganization, saving } = useOrganization();
  const { mode, setMode } = useThemeMode();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // Guarda a URL que falhou ao carregar; trocar a URL limpa o erro sem efeito colateral.
  const [brokenLogo, setBrokenLogo] = useState<string | null>(null);
  const currentLogo = logoUrl ?? organization?.logo_url ?? "";
  const logoBroken = brokenLogo === currentLogo;
  const brand = (organization?.primary_color ?? "").toLowerCase();

  const saveLogo = async () => {
    const value = currentLogo.trim();
    if (value && !/^https:\/\//.test(value)) {
      toast.error("Use um endereço que comece com https://");
      return;
    }
    try {
      await updateOrganization({ organization: { logo_url: value || null } });
      setLogoUrl(null);
      toast.success("Logo atualizado.");
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível salvar o logo."));
    }
  };

  const pickBrand = async (hex: string) => {
    try {
      await updateOrganization({ organization: { primary_color: hex } });
      toast.success("Cor da marca atualizada. Ela aparece na página de reserva online.");
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível salvar a cor."));
    }
  };

  return (
    <SettingsSection title="Identidade visual" description="Logo e cor aplicados na página de reserva online.">
      <Panel className="flex flex-col gap-[22px] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-af-lg border border-dashed border-af-line2 bg-[repeating-linear-gradient(45deg,var(--af-surface2)_0_6px,var(--af-surface)_6px_12px)] font-mono text-[10px] text-af-ink3">
            {currentLogo && !logoBroken ? <img src={currentLogo} alt="Logo atual" className="h-full w-full bg-white object-contain" onError={() => setBrokenLogo(currentLogo)} /> : "logo"}
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Logo</span>
            <input aria-label="Endereço do logo" className="af-input" placeholder="https://… (PNG ou SVG, fundo transparente)" value={currentLogo} onChange={(event) => setLogoUrl(event.target.value)} />
            <span className="text-xs text-af-ink3">Mínimo 256 × 256 px.</span>
          </div>
          <PanelButton disabled={logoUrl === null || saving} onClick={() => void saveLogo()}>Salvar logo</PanelButton>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">Cor da marca</span>
          <div role="radiogroup" aria-label="Cor da marca" className="flex flex-wrap gap-2.5">
            {BRAND_SWATCHES.map((swatch) => {
              const selected = brand === swatch.hex;
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={swatch.name}
                  title={swatch.name}
                  disabled={saving}
                  onClick={() => void pickBrand(swatch.hex)}
                  className="h-8 w-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent focus-visible:ring-offset-2"
                  style={{ background: swatch.hex, boxShadow: selected ? `0 0 0 2px var(--af-surface), 0 0 0 4px ${swatch.hex}` : "none" }}
                />
              );
            })}
          </div>
          <Link to="/dashboard/theme" className="text-xs font-medium text-af-accent hover:underline">Personalização avançada de cores</Link>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">Tema do painel</span>
          <Segmented label="Tema do painel" value={mode} onChange={setMode} options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
        </div>
      </Panel>
    </SettingsSection>
  );
}

/**
 * Aba Plano e faturas: resumo do plano com atalho para a Assinatura.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function BillingTab() {
  const { profile } = useAuth();
  const { subscription } = useOrganization();
  return (
    <Panel className="flex flex-wrap items-center gap-4 p-5">
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold">Plano {subscription.plan.name}{subscription.isTrial ? " · teste grátis" : ""}</span>
        <span className="text-[13px] text-af-ink2">
          {subscription.isTrial && subscription.trialDaysLeft !== null
            ? `${subscription.trialDaysLeft} dias restantes. Depois, R$ ${subscription.plan.monthlyPrice},00 por mês.`
            : `R$ ${subscription.plan.monthlyPrice},00 por mês.`}
        </span>
      </div>
      {profile?.role === "owner" ? (
        <Link to="/dashboard/subscription" className="inline-flex h-[34px] items-center rounded-lg bg-af-accent px-3.5 text-[13px] font-medium text-af-on-accent no-underline hover:bg-af-accent-hover">
          Gerenciar assinatura
        </Link>
      ) : (
        <span className="text-xs text-af-ink3">Somente a proprietária(o) gerencia a assinatura.</span>
      )}
    </Panel>
  );
}

/**
 * Configurações em abas (estado na URL ?tab= para links diretos).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function SettingsPage() {
  const { profile } = useAuth();
  const { organization } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS.find((item) => item.id === searchParams.get("tab"))?.id ?? "profile") as TabId;

  return (
    <Page>
      <PageHeader eyebrow={organization?.name ?? "Seu negócio"} title="Configurações" />

      <div role="tablist" aria-label="Seções de configurações" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-af-line">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSearchParams({ tab: item.id }, { replace: true })}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-af-accent",
                active ? "border-af-accent font-medium text-af-ink" : "border-transparent text-af-ink2 hover:text-af-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="flex flex-col gap-5 min-[720px]:gap-7">
        {tab === "profile" && <ProfileTab />}
        {tab === "look" && <AppearanceTab />}
        {tab === "booking" && (
          <SettingsSection title="Reserva online" description="Página pública onde clientes escolhem serviço, profissional e horário.">
            {profile?.organization_id && organization?.slug ? (
              <PublicBookingSettings organizationId={profile.organization_id} slug={organization.slug} />
            ) : (
              <Skeleton className="h-[320px]" />
            )}
          </SettingsSection>
        )}
        {tab === "billing" && <BillingTab />}
      </div>
    </Page>
  );
}
