
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

export function DashboardLayout() {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Clientes", href: "/dashboard/customers", icon: Users },
    ...(isAdmin ? [{ name: "Funcionários", href: "/dashboard/employees", icon: UserCircle }] : []),
    { name: "Configurações", href: "/dashboard/settings", icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4">
      <div className="flex h-14 items-center border-b px-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <Calendar className="h-6 w-6 text-primary" />
          <span className="">Agenda Fácil</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-4 text-sm font-medium">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={profile?.full_name || ""} />
                  <AvatarFallback>{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{profile?.full_name}</span>
                  <span className="text-xs text-muted-foreground truncate w-[120px]">
                    {profile?.role === 'owner' ? 'Dono' : 
                     profile?.role === 'admin' ? 'Administrador' : 'Funcionário'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
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
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block backdrop-blur-xl bg-white/30 dark:bg-black/30">
        <SidebarContent />
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 lg:h-[60px] backdrop-blur-xl bg-white/30 dark:bg-black/30 md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            <span className="font-semibold md:hidden">Agenda Fácil</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
