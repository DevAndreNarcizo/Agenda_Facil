import { useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Calendar, Users, LayoutDashboard, Settings, LogOut, Menu, UserCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle"; // Importando o componente de troca de tema

// Layout Principal do Dashboard
// Este componente define a estrutura comum de todas as páginas internas (Sidebar + Header + Conteúdo)
export function DashboardLayout() {
  // Hooks de navegação e contexto
  const { signOut, profile } = useAuth(); // Acesso às funções de auth e perfil do usuário
  const location = useLocation(); // Para saber a rota atual e destacar o item no menu
  const navigate = useNavigate(); // Para redirecionamento programático
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Estado para controlar o menu mobile

  // Função para realizar logout
  const handleSignOut = async () => {
    await signOut();
    navigate("/login"); // Redireciona para login após sair
  };

  // Verifica se o usuário tem permissões administrativas
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  // Definição dos itens de navegação
  // O array permite renderizar o menu dinamicamente
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Clientes", href: "/dashboard/customers", icon: Users },
    // Renderiza o item "Funcionários" apenas se for admin
    ...(isAdmin ? [{ name: "Funcionários", href: "/dashboard/employees", icon: UserCircle }] : []),
    { name: "Configurações", href: "/dashboard/settings", icon: Settings },
  ];

  // Componente interno para o conteúdo da Sidebar (reutilizado no Desktop e Mobile)
  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4">
      {/* Logo e Título */}
      <div className="flex h-14 items-center border-b px-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <Calendar className="h-6 w-6 text-primary" />
          <span className="">Agenda Fácil</span>
        </Link>
      </div>

      {/* Navegação Principal */}
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-4 text-sm font-medium">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                // Classes condicionais para destacar o item ativo
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                // Fecha o menu mobile ao clicar em um item
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Rodapé da Sidebar com Perfil do Usuário */}
      <div className="border-t p-4">
        <div className="flex items-center gap-4">
          {/* Botão de Troca de Tema */}
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={profile?.full_name || ""} />
                  {/* Fallback: Primeira letra do nome ou 'U' */}
                  <AvatarFallback>{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{profile?.full_name}</span>
                  <span className="text-xs text-muted-foreground truncate w-[120px]">
                    {/* Exibe o cargo de forma amigável */}
                    {profile?.role === 'owner' ? 'Dono' : 
                     profile?.role === 'admin' ? 'Administrador' : 'Funcionário'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            
            {/* Menu Dropdown do Usuário */}
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  return (
    // Grid Layout: Define a estrutura responsiva (Sidebar fixa no desktop)
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      
      {/* Sidebar Desktop (oculta em mobile) */}
      {/* Glassmorphism Premium: Fundo translúcido com blur forte e borda sutil */}
      <div className="hidden border-r border-white/10 bg-background/60 md:block backdrop-blur-xl">
        <SidebarContent />
      </div>

      {/* Área Principal de Conteúdo */}
      <div className="flex flex-col">
        
        {/* Header Mobile (oculto em desktop) */}
        <header className="flex h-14 items-center gap-4 border-b border-white/10 bg-background/60 px-6 lg:h-[60px] backdrop-blur-xl md:hidden sticky top-0 z-50">
          {/* Menu Mobile (Sheet/Drawer) */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden hover:bg-white/10">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 bg-background/80 backdrop-blur-2xl border-r border-white/10">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            <span className="font-semibold md:hidden">Agenda Fácil</span>
          </div>
        </header>

        {/* Main Content Area */}
        {/* Outlet renderiza o componente da rota filha atual */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
