import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { CustomerCombobox } from "./customer-combobox";
import { NewCustomerDialog } from "./new-customer-dialog";
import { useAvailability } from "@/hooks/use-availability";
import { useEmployees } from "@/hooks/use-employees";
import { usePromotions } from "@/hooks/use-promotions";
import { toast } from "sonner";

interface NewAppointmentModalProps {
  onAppointmentCreated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultDate?: Date;
  trigger?: ReactNode;
  hideTrigger?: boolean;
}

const toLocalDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toLocalTimeInput = (value: Date) => {
  const hours = value.getHours();
  const minutes = value.getMinutes();

  if (hours === 0 && minutes === 0) {
    return "09:00";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export function NewAppointmentModal({
  onAppointmentCreated,
  open: controlledOpen,
  onOpenChange,
  defaultDate,
  trigger,
  hideTrigger = false,
}: NewAppointmentModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<{ id: string; name: string; price: number; duration_minutes: number }[]>([]);
  const { profile } = useAuth();
  const { checkAvailability } = useAvailability();
  const { employees } = useEmployees();
  const { promotions } = usePromotions();
  const open = controlledOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.organization_id]);

  useEffect(() => {
    if (!open || !defaultDate) return;

    setDate(toLocalDateInput(defaultDate));
    setTime(toLocalTimeInput(defaultDate));
  }, [defaultDate, open]);

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
    } catch {
      toast.error("Erro ao criar cliente.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !serviceId || !date || !time || !profile?.organization_id) return;

    // Validação: impedir data no passado
    const startCheck = new Date(`${date}T${time}`);
    const now = new Date();
    if (startCheck < now) {
      toast.error("Não é possível agendar no passado. Selecione uma data/horário futuro.");
      return;
    }

    // Validação: horário comercial (7h - 21h)
    const hourCheck = startCheck.getHours();
    if (hourCheck < 7 || hourCheck >= 21) {
      toast.error("Horário fora do expediente (7h às 21h).");
      return;
    }

    setLoading(true);
    try {
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
      setCustomerName("");
      setServiceId("");
      setEmployeeId("");
      setPromotionId(null);
      setDate("");
      setTime("");
      toast.success("Agendamento criado com sucesso!");
    } catch {
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
        {!hideTrigger && (
          <DialogTrigger asChild>
            {trigger || (
              <Button className="h-14 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <span className="material-symbols-outlined font-black">add_circle</span>
                Novo Agendamento
              </Button>
            )}
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
          <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
                <span className="material-symbols-outlined text-3xl">event_available</span>
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-stitch-on-surface">Novo Agendamento</DialogTitle>
                <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                  Preencha os detalhes para agendar um novo serviço.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6 mt-4">
            
            <div className="space-y-2">
              <Label className="text-sm font-bold ml-1">Cliente</Label>
              <CustomerCombobox
                value={customerId}
                onChange={setCustomerId}
                onCustomerSelect={(c) => setCustomerName(c?.name || "")}
                onRequestCreate={handleRequestCreateCustomer}
                customerName={customerName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee" className="text-sm font-bold ml-1">Profissional (Opcional)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">badge</span>
                <select
                  id="employee"
                  className="flex h-14 w-full pl-12 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none"
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 pointer-events-none">unfold_more</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service" className="text-sm font-bold ml-1">Serviço</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">content_cut</span>
                <select
                  id="service"
                  className="flex h-14 w-full pl-12 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none"
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 pointer-events-none">unfold_more</span>
              </div>
            </div>

            {serviceId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="promotion" className="text-sm font-bold ml-1 text-stitch-primary">Promoção Ativa</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-60">sell</span>
                  <select
                    id="promotion"
                    className="flex h-14 w-full pl-12 rounded-xl border-2 border-stitch-primary/20 border-dashed bg-stitch-primary/5 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none font-bold text-stitch-primary"
                    value={promotionId || ""}
                    onChange={(e) => setPromotionId(e.target.value || null)}
                  >
                    <option value="">Sem promoção aplicada</option>
                    {promotions
                      ?.filter(p => p.active && (!p.service_id || p.service_id === serviceId))
                      .map((promo) => (
                        <option key={promo.id} value={promo.id}>
                          {promo.name} ({promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `R$ ${promo.discount_value} OFF`})
                        </option>
                      ))}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-40 pointer-events-none">expand_more</span>
                </div>
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
                      <div className="flex items-center gap-2 px-4 py-2 bg-stitch-primary/10 rounded-lg border border-stitch-primary/20">
                        <span className="text-xs font-bold text-stitch-primary">Total:</span>
                        <span className="text-xs line-through text-stitch-on-surface-variant opacity-40 font-bold">R$ {service.price}</span>
                        <span className="text-sm font-black text-stitch-primary">R$ {finalPrice.toFixed(2)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-bold ml-1">Data</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">calendar_today</span>
                  <Input
                    id="date"
                    type="date"
                    className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="text-sm font-bold ml-1">Horário</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">schedule</span>
                  <Input
                    id="time"
                    type="time"
                    className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Agendando...
                  </span>
                ) : (
                  <>
                    <span className="material-symbols-outlined font-black">check_circle</span>
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
