import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/context/auth-context-types";
import { useOrganizationTheme } from "@/hooks/use-organization-theme";
import { useOrganization, useTodayAppointmentCount } from "@/hooks/use-organization";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { Icon, IconAction, InitialsAvatar, PanelButton } from "@/components/panel/primitives";
import { RowMenu } from "@/components/panel/row-menu";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.png";

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  /** Perfis com acesso; ausente = todos os membros. Espelha as ProtectedRoute do App. */
  roles?: UserRole[];
  /** Exibido na barra inferior do celular. */
  mobile?: boolean;
}

const NAVIGATION: NavigationItem[] = [
  { name: "Início", href: "/dashboard", icon: "space_dashboard", mobile: true },
  { name: "Agenda", href: "/dashboard/calendar", icon: "calendar_month", mobile: true },
  { name: "Clientes", href: "/dashboard/customers", icon: "group", mobile: true },
  { name: "Profissionais", href: "/dashboard/employees", icon: "badge", roles: ["owner", "admin"] },
  { name: "Serviços", href: "/dashboard/services", icon: "spa", roles: ["owner", "admin"], mobile: true },
  { name: "Analytics", href: "/dashboard/analytics", icon: "monitoring", mobile: true },
  { name: "Assinatura", href: "/dashboard/subscription", icon: "credit_card", roles: ["owner"] },
  { name: "Configurações", href: "/dashboard/settings", icon: "settings", roles: ["owner", "admin"] },
];

const ROLE_LABELS: Record<string, string> = { owner: "Proprietária(o)", admin: "Administrador", employee: "Profissional", staff: "Equipe" };

/**
 * Verifica se a rota atual pertence ao item de navegação (Início só casa exatamente).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" || pathname === "/dashboard/" : pathname.startsWith(href);
}

/**
 * Layout do painel refinado: sidebar 232px (≥1100), rail de ícones 64px (720–1099)
 * e barra inferior no celular (<720), com cabeçalho fixo de 56px.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function DashboardLayout() {
  const { signOut, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { organization, subscription } = useOrganization();
  const todayCount = useTodayAppointmentCount();
  const { mode, toggle } = useThemeMode();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useOrganizationTheme();

  // Perfil sem organização ainda precisa concluir o onboarding.
  useEffect(() => {
    if (!loading && profile && !profile.organization_id) {
      navigate("/onboarding", { replace: true });
    }
  }, [profile, loading, navigate]);

  // Atalho ⌘K / Ctrl+K foca a busca global do cabeçalho.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (loading || (profile && !profile.organization_id)) {
    return (
      <div className="af-root flex min-h-screen items-center justify-center bg-af-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-af-line border-t-af-accent" />
          <p className="text-[13px] text-af-ink2">Carregando…</p>
        </div>
      </div>
    );
  }

  const role = profile?.role ?? "employee";
  const navigation = NAVIGATION.filter((item) => !item.roles || item.roles.includes(role));
  const mobileNavigation = navigation.filter((item) => item.mobile).slice(0, 5);
  const current = navigation.find((item) => isActiveRoute(location.pathname, item.href));
  const isCalendar = location.pathname.startsWith("/dashboard/calendar");

  /**
   * Encerra a sessão e volta ao login.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  /**
   * Busca global: leva à lista de clientes já filtrada pelo termo.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/dashboard/customers?q=${encodeURIComponent(term)}` : "/dashboard/customers");
  };

  /**
   * Abre o modal de novo agendamento na Agenda, preservando os filtros quando já está nela.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const openNewAppointment = () => {
    const params = new URLSearchParams(isCalendar ? location.search : "");
    params.set("new", "1");
    navigate(`/dashboard/calendar?${params.toString()}`);
  };

  const trialLabel = subscription.isTrial
    ? `Plano ${subscription.plan.name} · teste grátis${subscription.trialDaysLeft !== null ? `, ${subscription.trialDaysLeft} dias restantes` : ""}`
    : `Plano ${subscription.plan.name}${subscription.status === "active" ? " · ativo" : ""}`;

  return (
    <div className="af-root grid h-screen grid-cols-[minmax(0,1fr)] overflow-hidden bg-af-bg text-af-ink min-[720px]:grid-cols-[64px_minmax(0,1fr)] min-[1100px]:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden h-screen flex-col overflow-y-auto border-r border-af-line bg-af-bg min-[720px]:flex">
        <div className="flex items-center justify-center gap-2.5 px-[18px] pb-6 pt-5 min-[1100px]:justify-start">
          <img src={logoMark} alt="AgendaFácil" className="h-9 w-9 flex-none object-contain" />
          <div className="hidden flex-col gap-px min-[1100px]:flex">
            <span className="text-[17px] font-bold leading-[1.1] tracking-[-0.03em]">
              Agenda<span className="text-af-accent">Fácil</span>
            </span>
            <span className="truncate text-[11px] text-af-ink3">{organization?.name ?? " "}</span>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-0.5 px-3">
          {navigation.map((item) => {
            const active = isActiveRoute(location.pathname, item.href);
            const badge = item.href === "/dashboard/calendar" && todayCount > 0 ? String(todayCount) : "";
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.name}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-af-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent min-[1100px]:justify-start",
                  active ? "bg-af-surface font-medium text-af-ink" : "text-af-ink2",
                )}
              >
                <Icon name={item.icon} size={19} fill={active} className={active ? "text-af-accent" : "text-af-ink3"} />
                <span className="hidden flex-1 whitespace-nowrap min-[1100px]:inline">{item.name}</span>
                {badge && <span className="hidden text-[11px] text-af-ink3 min-[1100px]:inline">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        {role === "owner" && (
          <div className="m-3 hidden flex-col gap-2 rounded-af border border-af-line bg-af-surface p-3 min-[1100px]:flex">
            <span className="text-xs text-af-ink2">{trialLabel}</span>
            {subscription.isTrial && (
              <div className="h-1 overflow-hidden rounded-sm bg-af-surface2">
                <div className="h-full bg-af-accent" style={{ width: `${Math.round(subscription.trialProgress * 100)}%` }} />
              </div>
            )}
            <Link to="/dashboard/subscription" className="text-xs font-medium text-af-accent hover:underline">
              Gerenciar assinatura
            </Link>
          </div>
        )}

        <RowMenu
          side="top"
          align="start"
          label="Menu da conta"
          items={[
            ...(role === "owner" || role === "admin" ? [{ label: "Configurações", icon: "settings", onSelect: () => navigate("/dashboard/settings") }] : []),
            { label: mode === "dark" ? "Tema claro" : "Tema escuro", icon: mode === "dark" ? "light_mode" : "dark_mode", onSelect: toggle },
            { label: "Encerrar sessão", icon: "logout", danger: true, onSelect: () => void handleSignOut() },
          ]}
          trigger={
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2.5 border-t border-af-line px-[18px] py-3.5 text-left hover:bg-af-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-af-accent min-[1100px]:justify-start"
            >
              <InitialsAvatar initials={getInitials(profile?.full_name)} size={30} />
              <span className="hidden min-w-0 flex-1 flex-col min-[1100px]:flex">
                <span className="truncate text-[13px] font-medium">{profile?.full_name || "Usuário"}</span>
                <span className="text-[11px] text-af-ink3">{ROLE_LABELS[role] ?? "Equipe"}</span>
              </span>
              <Icon name="unfold_more" size={18} className="hidden text-af-ink3 min-[1100px]:inline-block" />
            </button>
          }
        />
      </aside>

      <div className="flex h-screen min-w-0 flex-col overflow-y-auto">
        <header className="sticky top-0 z-[5] flex h-14 flex-shrink-0 items-center gap-3 border-b border-af-line bg-af-bg px-4 min-[720px]:px-8">
          <img src={logoMark} alt="AgendaFácil" className="h-8 w-8 flex-shrink-0 object-contain min-[720px]:hidden" />
          <span className="whitespace-nowrap text-sm text-af-ink2">{current?.name ?? "Início"}</span>
          <div className="flex-1" />
          <form
            role="search"
            onSubmit={handleSearch}
            className="hidden h-8 min-w-0 flex-[0_1_280px] items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg border border-af-line bg-af-surface px-2.5 text-[13px] text-af-ink3 focus-within:border-af-accent min-[860px]:flex"
          >
            <Icon name="search" size={17} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="min-w-0 flex-1 bg-transparent text-af-ink outline-none placeholder:text-af-ink3"
            />
            <kbd className="rounded border border-af-line px-[5px] py-px font-sans text-[11px]">⌘K</kbd>
          </form>
          <IconAction icon={mode === "dark" ? "light_mode" : "dark_mode"} label="Alternar tema" size={20} onClick={toggle} />
          <span className="relative inline-flex p-1.5 text-af-ink2" title="Notificações">
            <Icon name="notifications" size={20} />
            <span className="absolute right-2 top-[7px] h-1.5 w-1.5 rounded-full bg-af-accent" />
          </span>
          <PanelButton variant="primary" icon="add" onClick={openNewAppointment} aria-label="Novo agendamento">
            <span className="hidden min-[560px]:inline">Novo agendamento</span>
          </PanelButton>
        </header>

        <main className="box-border w-full flex-1 px-4 pb-6 pt-5 min-[720px]:px-8 min-[720px]:pb-12 min-[720px]:pt-7 min-[1400px]:px-12 min-[1400px]:pb-14 min-[1400px]:pt-8">
          <Outlet />
        </main>

        <nav aria-label="Navegação inferior" style={{ gridTemplateColumns: `repeat(${mobileNavigation.length}, minmax(0, 1fr))` }} className="sticky bottom-0 grid flex-shrink-0 border-t border-af-line bg-af-surface px-1 pb-2.5 pt-1.5 min-[720px]:hidden">
          {mobileNavigation.map((item) => {
            const active = isActiveRoute(location.pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 flex-col items-center gap-[3px] py-1.5", active ? "text-af-accent" : "text-af-ink3")}
              >
                <Icon name={item.icon} size={22} fill={active} />
                <span className={cn("text-[11px]", active && "font-medium")}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
