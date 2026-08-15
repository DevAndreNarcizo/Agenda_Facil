import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getPortalSession, logoutPortalSession } from "@/lib/portal-api";

export default function PortalLayout() {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    /**
     * Valida a sessão no servidor antes de renderizar qualquer conteúdo do portal.
     *
     * @author André Narcizo
     */
    const loadSession = async (): Promise<void> => {
      try {
        const customer = await getPortalSession();
        if (isMounted) setCustomerName(customer.name);
      } catch {
        navigate("/portal/login", { replace: true });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadSession();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  /**
   * Revoga a sessão no servidor antes de retornar ao login.
   *
   * @author André Narcizo
   */
  const handleLogout = async (): Promise<void> => {
    await logoutPortalSession();
    navigate("/portal/login", { replace: true });
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-stitch-surface text-stitch-on-surface font-body flex flex-col relative overflow-x-hidden">
      {/* Background Decorative Element */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[500px] bg-stitch-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* Modern Header */}
      <header className="sticky top-0 z-50 w-full px-4 py-4 max-w-md mx-auto">
        <nav className="bg-white/80 backdrop-blur-xl border border-stitch-outline-variant/10 rounded-[2rem] px-5 h-16 flex items-center justify-between shadow-lg shadow-stitch-primary/5 transition-all">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-stitch-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-stitch-primary text-2xl font-black">person</span>
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant opacity-50">Bem-vindo(a)</span>
              <span className="font-headline font-black text-stitch-on-surface text-sm">
                {customerName?.split(" ")[0] || "Cliente"}
              </span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout} 
            className="w-10 h-10 rounded-2xl hover:bg-stitch-error/10 hover:text-stitch-error transition-all group/logout"
          >
            <span className="material-symbols-outlined text-xl transition-transform group-hover/logout:rotate-12">logout</span>
          </Button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
        <Outlet />
      </main>

      {/* Bottom Padding for Mobile Nav if added later */}
      <div className="h-4 sm:hidden"></div>
    </div>
  );
}
