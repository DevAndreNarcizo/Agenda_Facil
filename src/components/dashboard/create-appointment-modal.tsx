import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { CustomerCombobox } from "./customer-combobox";
import { useAvailability } from "@/hooks/use-availability";
import { toast } from "sonner";

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppointmentCreated: () => void;
  defaultDate?: Date;
}

export function CreateAppointmentModal({ 
  open, 
  onOpenChange, 
  onAppointmentCreated,
  defaultDate
}: CreateAppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<{ id: string; name: string; price: number; duration_minutes: number }[]>([]);
  const { profile } = useAuth();
  const { checkAvailability } = useAvailability();

  // Form State
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", profile?.organization_id);
      setServices(data || []);
    };

    if (open && profile?.organization_id) {
      fetchServices();
      if (defaultDate) {
        setDate(defaultDate.toISOString().split('T')[0]);
        setTime(defaultDate.toTimeString().slice(0, 5));
      }
    }
  }, [open, profile?.organization_id, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !date || !time) return;
    if (!isBlocked && (!customerId || !serviceId)) {
        toast.error("Por favor, selecione um cliente e um serviço.");
        return;
    }

    // Validação: impedir data no passado
    const startDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (startDateTime < now) {
      toast.error("Não é possível agendar no passado. Selecione uma data/horário futuro.");
      return;
    }

    // Validação: horário comercial (7h - 21h)
    const hour = startDateTime.getHours();
    if (hour < 7 || hour >= 21) {
      toast.error("Horário fora do expediente (7h às 21h).");
      return;
    }

    setLoading(true);
    try {
      let endDateTime;

      if (isBlocked) {
        endDateTime = new Date(startDateTime.getTime() + 60 * 60000);
      } else {
        const service = services.find(s => s.id === serviceId);
        const duration = service?.duration_minutes || 30;
        endDateTime = new Date(startDateTime.getTime() + duration * 60000);
      }

      // Check availability
      const isAvailable = await checkAvailability(
        startDateTime.toISOString(),
        endDateTime.toISOString()
      );

      if (!isAvailable) {
        toast.error("Este horário está ocupado! Escolha outro horário.");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .insert({
          organization_id: profile.organization_id,
          customer_id: isBlocked ? null : customerId,
          customer_name: isBlocked ? "HORÁRIO BLOQUEADO" : customerName,
          service_id: isBlocked ? null : serviceId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: isBlocked ? 'cancelled' : 'pending',
          is_blocked: isBlocked
        });

      if (error) throw error;

      onOpenChange(false);
      onAppointmentCreated();
      toast.success(isBlocked ? "Horário bloqueado com sucesso!" : "Agendamento criado com sucesso!");

      // Reset form
      setCustomerId("");
      setCustomerName("");
      setServiceId("");
      setIsBlocked(false);

    } catch {
      toast.error("Erro ao criar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">{isBlocked ? 'block' : 'add_task'}</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-stitch-on-surface">
                {isBlocked ? 'Bloquear Horário' : 'Novo Agendamento'}
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Preencha os dados para {isBlocked ? 'bloquear sua agenda' : 'agendar um cliente'}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6 mt-4">
          
          <div className="flex items-center justify-between p-6 rounded-2xl bg-stitch-surface-container-low/30 border border-stitch-outline-variant/10">
            <div className="space-y-0.5">
                <Label className="text-sm font-bold">Bloquear Horário</Label>
                <p className="text-[10px] text-stitch-on-surface-variant opacity-60 uppercase font-black tracking-widest">Ficará indisponível para clientes</p>
            </div>
            <Switch checked={isBlocked} onCheckedChange={setIsBlocked} />
          </div>

          {!isBlocked && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Cliente</Label>
                <CustomerCombobox
                  value={customerId}
                  onChange={setCustomerId}
                  onCustomerSelect={(c) => setCustomerName(c?.name || "")}
                  onRequestCreate={() => {}} 
                  customerName={customerName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Serviço</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">content_cut</span>
                  <select
                    id="service"
                    className="flex h-14 w-full pl-12 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none placeholder:text-white/20"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    required={!isBlocked}
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
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Data</Label>
              <div className="relative group">
                <Input
                  id="date"
                  type="date"
                  className="pl-4 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-4"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Horário</Label>
              <div className="relative group">
                <Input
                  id="time"
                  type="time"
                  className="pl-4 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-4"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4" disabled={loading}>
            {loading ? "Processando..." : (isBlocked ? "Bloquear Horário" : "Agendar Agora")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
