import { useState, useEffect, type FormEvent } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/context/auth-context-types";
import { useOrganizationTheme } from "@/hooks/use-organization-theme";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewAppointmentModal } from "@/components/dashboard/new-appointment-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  keywords?: string[];
}

interface SidebarProps {
  navigation: NavigationItem[];
  profile: Profile | null;
  location: { pathname: string };
  setIsMobileMenuOpen: (open: boolean) => void;
  onSignOut: () => void;
}

const SidebarContent = ({ navigation, profile, location, setIsMobileMenuOpen, onSignOut }: SidebarProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredNavigation = normalizedSearch
    ? navigation.filter((item) => {
        const haystack = [item.name, item.href, item.icon, ...(item.keywords || [])].join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : navigation;

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstResult = filteredNavigation[0];
    if (!firstResult) return;

    navigate(firstResult.href);
    setSearchTerm("");
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-full flex-col gap-1 border-r border-[var(--af-divider)] bg-[var(--af-surface-lowest)] px-4 py-[22px] text-[var(--af-on-surface)]">
      <div className="flex items-center gap-3 px-2 pb-[22px]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--af-primary)] to-[var(--af-primary-hover)] text-white shadow-[0_6px_14px_rgba(83,67,212,0.30)]">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-headline text-[17px] font-black leading-none tracking-[-0.025em] text-[var(--af-on-surface)]">
            Agenda<span className="text-[var(--af-primary)]">Fácil</span>
          </h1>
          <p className="af-eb mt-1.5 truncate text-[var(--af-on-surface-variant)] opacity-55">
            {profile?.role === "owner" ? "Workspace Premium" : "Workspace"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-3 flex items-center gap-2 rounded-[10px] bg-[var(--af-surface-low)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--af-primary-soft)]">
        <span className="material-symbols-outlined text-lg text-[var(--af-on-surface-variant)] opacity-60">search</span>
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--af-on-surface)] outline-none placeholder:text-[var(--af-on-surface-variant)] placeholder:opacity-60"
          placeholder="Buscar..."
          aria-label="Buscar no menu"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="rounded p-0.5 text-[var(--af-on-surface-variant)] transition-colors hover:bg-[var(--af-surface-med)] hover:text-[var(--af-on-surface)]"
            aria-label="Limpar busca"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        ) : (
          <span className="ml-auto rounded border border-[var(--af-outline-variant)] px-1.5 py-px text-[10px] font-extrabold text-[var(--af-on-surface-variant)] opacity-40">Enter</span>
        )}
      </form>

      <div className="af-eb px-3 pb-1.5 pt-2 text-[var(--af-on-surface-variant)] opacity-45">Workspace</div>

      <nav className="flex-1 space-y-1">
        {filteredNavigation.map((item) => {
          const isCurrent = item.href === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn("af-nav-item", isCurrent && "active")}
              onClick={() => {
                setSearchTerm("");
                setIsMobileMenuOpen(false);
              }}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
        {filteredNavigation.length === 0 && (
          <div className="rounded-[12px] px-3 py-4 text-xs font-bold text-[var(--af-on-surface-variant)] opacity-55">
            Nenhum item encontrado.
          </div>
        )}
      </nav>

      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--af-divider)] bg-[var(--af-surface-low)] p-3 text-left transition-colors hover:bg-[var(--af-surface-med)]">
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-[var(--af-primary-soft)] text-[var(--af-primary)] font-black">
                    {profile?.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 overflow-hidden">
                  <p className="truncate font-headline text-[13px] font-extrabold text-[var(--af-on-surface)]">{profile?.full_name || "Usuário"}</p>
                  <p className="text-[11px] text-[var(--af-on-surface-variant)] opacity-60">
                    {profile?.role === 'owner' ? 'Proprietário' :
                      profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-lg text-[var(--af-on-surface-variant)] opacity-55">more_horiz</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mb-2 ml-2 w-[calc(var(--radix-dropdown-menu-trigger-width)-1rem)] rounded-xl border border-[var(--af-divider)] bg-[var(--af-surface-lowest)] text-[var(--af-on-surface)] shadow-xl" side="top" align="center">
            <DropdownMenuLabel className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--af-on-surface-variant)]/80">Configurações rápidas</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => window.location.href = '/dashboard/analytics'} className="gap-3 cursor-pointer px-4 py-3 font-bold focus:bg-[var(--af-primary-soft)] focus:text-[var(--af-primary)]">
              <span className="material-symbols-outlined text-lg">insights</span> Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.href = '/dashboard/settings'} className="gap-3 cursor-pointer px-4 py-3 font-bold focus:bg-[var(--af-primary-soft)] focus:text-[var(--af-primary)]">
              <span className="material-symbols-outlined text-lg">palette</span> Aparência
            </DropdownMenuItem>
            <div className="mx-2 my-1 h-px bg-[var(--af-divider)]" />
            <DropdownMenuItem
              onClick={onSignOut}
              className="group gap-3 cursor-pointer px-4 py-3 font-bold text-[var(--af-error)] focus:bg-[var(--af-error-bg)] focus:text-[var(--af-error)]"
            >
              <span className="material-symbols-outlined text-lg transition-transform group-hover:scale-110">logout</span> Encerrar sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// Layout Principal do Dashboard
export function DashboardLayout() {
  const { signOut, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);

  useOrganizationTheme();

  // Se profile carregou mas não tem organization_id, redirecionar para onboarding
  useEffect(() => {
    if (!loading && profile && !profile.organization_id) {
      navigate('/onboarding', { replace: true });
    }
  }, [profile, loading, navigate]);

  // Enquanto carrega ou redireciona, não mostra nada
  if (loading || (profile && !profile.organization_id)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stitch-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-stitch-on-surface-variant">Carregando...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/dashboard", icon: "dashboard", keywords: ["inicio", "home", "resumo"] },
    { name: "Agenda", href: "/dashboard/calendar", icon: "calendar_month", keywords: ["calendario", "agendamento", "horario"] },
    { name: "Clientes", href: "/dashboard/customers", icon: "person_search", keywords: ["pessoas", "contatos"] },
    { name: "Profissionais", href: "/dashboard/employees", icon: "group", keywords: ["equipe", "funcionarios", "colaboradores"] },
    { name: "Serviços", href: "/dashboard/services", icon: "content_cut", keywords: ["catalogo", "precos", "procedimentos"] },
    { name: "Analytics", href: "/dashboard/analytics", icon: "insights", keywords: ["relatorios", "metricas"] },
    { name: "Assinatura", href: "/dashboard/subscription", icon: "card_membership", keywords: ["plano", "pagamento"] },
    { name: "Configurações", href: "/dashboard/settings", icon: "settings", keywords: ["aparencia", "tema", "cores"] },
  ];

  const currentTitle = navigation.find(n => n.href === location.pathname)?.name || "Dashboard";
  const subtitle = location.pathname === "/dashboard"
    ? "Visão geral do seu estúdio."
    : "Gerencie operações, equipe e clientes em tempo real.";

  return (
    <div className="flex min-h-screen w-full bg-[var(--af-background)] transition-colors duration-500">
      
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[252px] flex-col md:flex">
        <SidebarContent 
          navigation={navigation} 
          profile={profile} 
          location={location} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col md:pl-[252px]">
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-[var(--af-divider)] bg-[var(--af-surface-lowest)] px-8 py-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="af-eb text-[var(--af-on-surface-variant)] opacity-50">Workspace</span>
              <span className="material-symbols-outlined text-xs text-[var(--af-on-surface-variant)] opacity-40">chevron_right</span>
              <span className="af-eb text-[var(--af-primary)] opacity-85">{currentTitle}</span>
            </div>
            <h2 className="m-0 font-headline text-[28px] font-black leading-tight tracking-[-0.025em] text-[var(--af-on-surface)]">
              {location.pathname === "/dashboard" ? `Bem-vindo, ${profile?.full_name?.split(" ")[0] || "Usuário"}` : currentTitle}
            </h2>
            <p className="mt-1 text-[13px] font-medium text-[var(--af-on-surface-variant)] opacity-70">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <NotificationsPanel />
            <button
              onClick={() => setNewAppointmentOpen(true)}
              className="af-btn af-btn-primary hidden sm:inline-flex"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Novo agendamento
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 pb-32 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-[24px] border-t border-[var(--af-divider)] bg-[var(--af-surface-lowest)] px-4 pb-7 pt-3 shadow-2xl md:hidden">
        <Link to="/dashboard" className={cn(
          "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
          location.pathname === '/dashboard' ? 'bg-[var(--af-primary-soft)] text-[var(--af-primary)]' : 'text-[var(--af-on-surface-variant)]'
        )}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname === '/dashboard' ? "'FILL' 1" : "" }}>home</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Início</span>
        </Link>
        <Link to="/dashboard/calendar" className={cn(
          "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
          location.pathname.includes('calendar') ? 'bg-[var(--af-primary-soft)] text-[var(--af-primary)]' : 'text-[var(--af-on-surface-variant)]'
        )}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.includes('calendar') ? "'FILL' 1" : "" }}>calendar_today</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Agenda</span>
        </Link>
        <Link to="/dashboard/customers" className={cn(
          "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
          location.pathname.includes('customers') ? 'bg-[var(--af-primary-soft)] text-[var(--af-primary)]' : 'text-[var(--af-on-surface-variant)]'
        )}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.includes('customers') ? "'FILL' 1" : "" }}>groups</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Clientes</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center p-2 text-[var(--af-on-surface-variant)]"
          aria-label="Abrir menu do dashboard"
        >
          <span className="material-symbols-outlined">menu_open</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Menu</span>
        </button>
      </nav>

      {/* Mobile Menu Overlay/Drawer */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-80 overflow-hidden rounded-r-[24px] border-none bg-[var(--af-background)] p-0 shadow-2xl">
          <SidebarContent 
            navigation={navigation} 
            profile={profile} 
            location={location} 
            setIsMobileMenuOpen={setIsMobileMenuOpen} 
            onSignOut={handleSignOut}
          />
        </SheetContent>
      </Sheet>

      {/* Global FAB */}
      <button 
        onClick={() => setNewAppointmentOpen(true)}
        className="fixed bottom-28 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--af-primary)] text-white shadow-2xl shadow-[rgba(83,67,212,0.40)] transition-all hover:scale-105 active:scale-95 md:hidden"
        aria-label="Novo agendamento"
      >
        <span className="material-symbols-outlined text-3xl font-black">add</span>
      </button>

      <NewAppointmentModal
        open={newAppointmentOpen}
        onOpenChange={setNewAppointmentOpen}
        hideTrigger
        onAppointmentCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["appointments", profile?.organization_id] });
        }}
      />
    </div>
  );
}
