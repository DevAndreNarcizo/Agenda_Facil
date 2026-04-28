import { useState, useEffect } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/context/auth-context-types";
import { useOrganizationTheme } from "@/hooks/use-organization-theme";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { cn } from "@/lib/utils";

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  navigation: NavigationItem[];
  profile: Profile | null;
  location: { pathname: string };
  setIsMobileMenuOpen: (open: boolean) => void;
  onSignOut: () => void;
}

const SidebarContent = ({ navigation, profile, location, setIsMobileMenuOpen, onSignOut }: SidebarProps) => (
  <div className="flex h-full flex-col bg-stitch-surface text-stitch-on-surface border-r border-stitch-outline-variant/10">
    {/* Brand Identity */}
    <div className="flex items-center gap-3 px-6 py-10 mb-2">
      <div className="w-10 h-10 bg-stitch-primary rounded-xl flex items-center justify-center text-stitch-on-primary shadow-lg shadow-stitch-primary/20">
        <span className="material-symbols-outlined font-black">content_cut</span>
      </div>
      <div>
        <h1 className="text-xl font-black text-stitch-primary tracking-tight">AgendaFácil</h1>
        <p className="text-[10px] uppercase tracking-widest text-stitch-on-surface-variant font-black">Premium Wellness</p>
      </div>
    </div>

    {/* Navigation */}
    <nav className="flex-1 px-4 space-y-2">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        const isCurrent = (isActive || (item.href === '/dashboard' && location.pathname === '/dashboard'));
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300",
              isCurrent 
                ? "text-stitch-primary font-black border-r-4 border-stitch-primary bg-stitch-primary/10 rounded-l-xl" 
                : "text-stitch-on-surface-variant hover:text-stitch-primary hover:bg-stitch-primary/5 font-bold"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isCurrent ? "'FILL' 1" : "" }}>{item.icon}</span>
            <span className="font-label">{item.name}</span>
          </Link>
        );
      })}
    </nav>

    {/* User Profile Section */}
    <div className="p-4 mt-auto border-t border-stitch-outline-variant/5 pt-6 mx-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center justify-between bg-stitch-surface-container-low/50 p-4 rounded-2xl border border-stitch-outline-variant/5 cursor-pointer group transition-all hover:bg-stitch-surface-container-low">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-10 w-10 border-2 border-stitch-surface-container-highest shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                 <AvatarImage src="" />
                 <AvatarFallback className="bg-stitch-primary/10 text-stitch-primary font-black">
                   {profile?.full_name?.charAt(0) || "U"}
                 </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-black truncate text-stitch-on-surface font-headline">{profile?.full_name || "Usuário"}</p>
                <p className="text-[10px] text-stitch-on-surface-variant uppercase font-black tracking-wider opacity-50">
                   {profile?.role === 'owner' ? 'Proprietário' : 
                    profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-stitch-on-surface-variant transition-transform group-hover:rotate-180">expand_less</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[calc(var(--radix-dropdown-menu-trigger-width)-1rem)] ml-2 mb-2 rounded-xl bg-stitch-surface text-stitch-on-surface border border-stitch-outline-variant/10 shadow-xl" side="top" align="center">
          <DropdownMenuLabel className="font-black text-xs uppercase tracking-widest text-stitch-on-surface-variant/80 px-4 py-2">Configurações Rápidas</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => window.location.href = '/dashboard/analytics'} className="gap-3 font-bold cursor-pointer py-3 px-4 focus:bg-stitch-primary/5 focus:text-stitch-primary">
            <span className="material-symbols-outlined text-lg">insights</span> Analytics
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.location.href = '/dashboard/settings'} className="gap-3 font-bold cursor-pointer py-3 px-4 focus:bg-stitch-primary/5 focus:text-stitch-primary">
            <span className="material-symbols-outlined text-lg">palette</span> Aparência
          </DropdownMenuItem>
          <div className="h-px bg-stitch-outline-variant/10 my-1 mx-2" />
          <DropdownMenuItem 
            onClick={onSignOut} 
            className="gap-3 font-bold cursor-pointer py-3 px-4 text-stitch-error focus:bg-stitch-error/10 focus:text-stitch-error group"
          >
            <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">logout</span> Encerrar Sessão
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

// Layout Principal do Dashboard
export function DashboardLayout() {
  const { signOut, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    { name: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { name: "Calendário", href: "/dashboard/calendar", icon: "calendar_month" },
    { name: "Clientes", href: "/dashboard/customers", icon: "person_search" },
    { name: "Profissionais", href: "/dashboard/employees", icon: "group" },
    { name: "Serviços", href: "/dashboard/services", icon: "content_cut" },
    { name: "Analytics", href: "/dashboard/analytics", icon: "insights" },
    { name: "Assinatura", href: "/dashboard/subscription", icon: "card_membership" },
    { name: "Configurações", href: "/dashboard/settings", icon: "settings" },
  ];

  const currentTitle = navigation.find(n => n.href === location.pathname)?.name || "Dashboard";

  return (
    <div className="flex min-h-screen w-full bg-stitch-background transition-colors duration-500">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-72 z-40">
        <SidebarContent 
          navigation={navigation} 
          profile={profile} 
          location={location} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main Container */}
      <div className="flex flex-col flex-1 md:pl-72">
        
        {/* Top Header */}
        <header className="h-20 flex justify-between items-center px-8 bg-stitch-background/80 backdrop-blur-xl sticky top-0 z-30 border-b border-stitch-outline-variant/10">
          <h2 className="font-black text-stitch-on-surface font-headline uppercase tracking-widest text-sm opacity-80">
            {currentTitle}
          </h2>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-6 w-[1px] bg-stitch-outline-variant/20 mx-1"></div>
            <NotificationsPanel />
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="p-8 pb-32 md:pb-8 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-8 pt-4 md:hidden bg-stitch-surface-container/95 backdrop-blur-md shadow-2xl border-t border-stitch-outline-variant/10 rounded-t-[32px]">
        <Link to="/dashboard" className={cn(
          "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
          location.pathname === '/dashboard' ? 'bg-stitch-primary/10 text-stitch-primary' : 'text-stitch-on-surface-variant'
        )}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname === '/dashboard' ? "'FILL' 1" : "" }}>home</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Início</span>
        </Link>
        <Link to="/dashboard/calendar" className={cn(
          "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
          location.pathname.includes('calendar') ? 'bg-stitch-primary/10 text-stitch-primary' : 'text-stitch-on-surface-variant'
        )}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.includes('calendar') ? "'FILL' 1" : "" }}>calendar_today</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Agenda</span>
        </Link>
        <Link to="/dashboard/customers" className={cn(
          "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
          location.pathname.includes('customers') ? 'bg-stitch-primary/10 text-stitch-primary' : 'text-stitch-on-surface-variant'
        )}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.includes('customers') ? "'FILL' 1" : "" }}>groups</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Clientes</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center p-2 text-stitch-on-surface-variant"
          aria-label="Abrir menu do dashboard"
        >
          <span className="material-symbols-outlined">menu_open</span>
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">Menu</span>
        </button>
      </nav>

      {/* Mobile Menu Overlay/Drawer */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-80 bg-stitch-background border-none rounded-r-[32px] shadow-2xl overflow-hidden">
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
        onClick={() => navigate('/dashboard/employees')}
        className="fixed bottom-28 right-6 md:bottom-10 md:right-10 w-16 h-16 bg-stitch-primary text-stitch-on-primary rounded-full shadow-2xl shadow-stitch-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
        aria-label="Adicionar profissional"
      >
        <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300 font-black">add</span>
      </button>
    </div>
  );
}
