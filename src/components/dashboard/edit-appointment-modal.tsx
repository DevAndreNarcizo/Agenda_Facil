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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { CustomerCombobox } from "./customer-combobox";
import { useAvailability } from "@/hooks/use-availability";
import type { Appointment } from "@/hooks/use-appointments";
import { toast } from "sonner";

interface EditAppointmentModalProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppointmentUpdated: () => void;
}

export function EditAppointmentModal({ 
  appointment, 
  open, 
  onOpenChange, 
  onAppointmentUpdated 
}: EditAppointmentModalProps) {
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

  useEffect(() => {
    if (open && profile?.organization_id) {
      fetchServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.organization_id]);

  useEffect(() => {
    if (appointment) {
      setCustomerId(appointment.customer_id || "");
      setCustomerName(appointment.customer_name);
      setServiceId(appointment.service_id);
      
      const start = new Date(appointment.start_time);
      setDate(start.toISOString().split('T')[0]);
      setTime(start.toTimeString().slice(0, 5));
    }
  }, [appointment]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", profile?.organization_id);
    setServices(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment || !customerId || !serviceId || !date || !time || !profile?.organization_id) return;

    // Validação: impedir data no passado
    const startCheck = new Date(`${date}T${time}`);
    const now = new Date();
    if (startCheck < now) {
      toast.error("Não é possível reagendar no passado.");
      return;
    }

    // Validação: horário comercial (7h - 21h)
    const hour = startCheck.getHours();
    if (hour < 7 || hour >= 21) {
      toast.error("Horário fora do expediente (7h às 21h).");
      return;
    }

    setLoading(true);
    try {
      const startDateTime = new Date(`${date}T${time}`);
      const service = services.find(s => s.id === serviceId);
      const duration = service?.duration_minutes || 30;
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      // Check availability (excluding current appointment)
      const isAvailable = await checkAvailability(
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        appointment.id
      );

      if (!isAvailable) {
        toast.error("Este horário já está ocupado! Por favor, escolha outro horário.");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .update({
          customer_id: customerId,
          customer_name: customerName,
          service_id: serviceId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
        })
        .eq("id", appointment.id);

      if (error) throw error;

      onOpenChange(false);
      onAppointmentUpdated();
      toast.success("Agendamento atualizado com sucesso!");
    } catch {
      toast.error("Erro ao atualizar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment || !confirm("Tem certeza que deseja cancelar este agendamento?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: 'cancelled' })
        .eq("id", appointment.id);

      if (error) throw error;

      onOpenChange(false);
      onAppointmentUpdated();
      toast.success("Agendamento cancelado com sucesso!");
    } catch {
      toast.error("Erro ao cancelar agendamento.");
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
              <span className="material-symbols-outlined text-3xl">edit_calendar</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-stitch-on-surface">Editar Agendamento</DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Altere os detalhes do agendamento ou cancele-o.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6 mt-4">
          
          <div className="space-y-2">
            <Label className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Cliente</Label>
            <CustomerCombobox
              value={customerId}
              onChange={setCustomerId}
              onCustomerSelect={(c) => setCustomerName(c?.name || "")}
              onRequestCreate={() => {}} // Disable creation in edit mode for simplicity
              customerName={customerName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-service" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Serviço</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">content_cut</span>
              <select
                id="edit-service"
                className="flex h-14 w-full pl-12 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none placeholder:text-white/20"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Data</Label>
              <div className="relative group">
                <Input
                  id="edit-date"
                  type="date"
                  className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Horário</Label>
              <div className="relative group">
                <Input
                  id="edit-time"
                  type="time"
                  className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined font-black">save</span>
                  Salvar Alterações
                </>
              )}
            </Button>
            
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                className="flex-1 h-12 rounded-xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100"
                onClick={() => onOpenChange(false)}
              >
                Voltar
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="flex-1 h-12 rounded-xl font-bold text-stitch-error hover:bg-stitch-error/5" 
                onClick={handleDelete}
                disabled={loading}
              >
                <span className="material-symbols-outlined text-sm mr-2">delete</span>
                Cancelar Agendamento
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
