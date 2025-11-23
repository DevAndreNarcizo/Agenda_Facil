import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export default function PortalLayout() {
  const navigate = useNavigate();
  const customerName = localStorage.getItem("portal_customer_name");

  useEffect(() => {
    const customerId = localStorage.getItem("portal_customer_id");
    if (!customerId) {
      navigate("/portal/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("portal_customer_id");
    localStorage.removeItem("portal_customer_name");
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-sm sm:text-base">
            Olá, {customerName?.split(" ")[0]}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
