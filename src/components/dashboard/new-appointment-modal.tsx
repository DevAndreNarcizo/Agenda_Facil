import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CustomerCombobox } from "./customer-combobox";
import { NewCustomerDialog } from "./new-customer-dialog";
import { useAvailability } from "@/hooks/use-availability";
import { useEmployees } from "@/hooks/use-employees";
import { usePromotions } from "@/hooks/use-promotions";
import { toast } from "sonner";

interface NewAppointmentModalProps {
  onAppointmentCreated: () => void;
}

export function NewAppointmentModal({ onAppointmentCreated }: NewAppointmentModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const { profile } = useAuth();
  const { checkAvailability } = useAvailability();
  const { employees } = useEmployees();
  const { promotions } = usePromotions();

  // Form State
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState(""); // For display/creation
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // New Customer Dialog State
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [pendingCustomerName, setPendingCustomerName] = useState("");

  useEffect(() => {
    if (open && profile?.organization_id) {
      fetchServices();
    }
  }, [open, profile?.organization_id]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", profile?.organization_id);
    setServices(data || []);
  };

  const handleRequestCreateCustomer = (name: string) => {
    setPendingCustomerName(name);
    setNewCustomerDialogOpen(true);
  };

  const handleCreateCustomer = async (data: { name: string; phone: string; email: string }) => {
    if (!profile?.organization_id) return;
    
    try {
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      setCustomerId(newCustomer.id);
      setCustomerName(newCustomer.name);
      toast.success("Cliente criado com sucesso!");
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Erro ao criar cliente.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !serviceId || !date || !time || !profile?.organization_id) return;

    setLoading(true);
    try {
      // Combine date and time
      const startDateTime = new Date(`${date}T${time}`);
      const service = services.find(s => s.id === serviceId);
      const duration = service?.duration_minutes || 30;
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      // Check availability (scoped to employee if selected)
      const isAvailable = await checkAvailability(
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        undefined,
        employeeId || undefined
      );

      if (!isAvailable) {
        toast.error("Este horário já está ocupado para este profissional! Por favor, escolha outro horário.");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .insert({
          organization_id: profile.organization_id,
          customer_id: customerId,
          customer_name: customerName, // Keep for cache/legacy
          service_id: serviceId,
          employee_id: employeeId || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed',
          promotion_id: promotionId || null
        });

      if (error) throw error;

      setOpen(false);
      onAppointmentCreated();
      // Reset form
      setCustomerId("");
      setServiceId("");
      setEmployeeId("");
      setPromotionId(null);
      setDate("");
      setTime("");
      toast.success("Agendamento criado com sucesso!");
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NewCustomerDialog
        open={newCustomerDialogOpen}
        onOpenChange={setNewCustomerDialogOpen}
        initialName={pendingCustomerName}
        onCreateCustomer={handleCreateCustomer}
      />
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Novo Agendamento</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Preencha os detalhes para agendar um novo serviço.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <CustomerCombobox
                value={customerId}
                onChange={setCustomerId}
                onCustomerSelect={(c) => setCustomerName(c?.name || "")}
                onRequestCreate={handleRequestCreateCustomer}
                customerName={customerName}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="employee">Profissional (Opcional)</Label>
              <select
                id="employee"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Qualquer profissional</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="service">Serviço</Label>
              <select
                id="service"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
              >
                <option value="">Selecione um serviço...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - R$ {service.price}
                  </option>
                ))}
              </select>

            </div>

            {serviceId && (
              <div className="grid gap-2">
                <Label htmlFor="promotion">Promoção (Opcional)</Label>
                <select
                  id="promotion"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={promotionId || ""}
                  onChange={(e) => setPromotionId(e.target.value || null)}
                >
                  <option value="">Sem promoção</option>
                  {promotions
                    ?.filter(p => p.active && (!p.service_id || p.service_id === serviceId))
                    .map((promo) => (
                      <option key={promo.id} value={promo.id}>
                        {promo.name} ({promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `R$ ${promo.discount_value} OFF`})
                      </option>
                    ))}
                </select>
                {promotionId && (() => {
                  const service = services.find(s => s.id === serviceId);
                  const promo = promotions?.find(p => p.id === promotionId);
                  if (service && promo) {
                    let finalPrice = service.price;
                    if (promo.discount_type === 'percentage') {
                      finalPrice = service.price * (1 - promo.discount_value / 100);
                    } else {
                      finalPrice = Math.max(0, service.price - promo.discount_value);
                    }
                    return (
                      <div className="text-sm text-muted-foreground mt-1">
                        Preço final: <span className="line-through">R$ {service.price}</span> <span className="font-bold text-green-600">R$ {finalPrice.toFixed(2)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time">Horário</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Agendando..." : "Agendar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
