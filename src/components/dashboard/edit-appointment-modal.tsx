import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
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
  const [services, setServices] = useState<any[]>([]);
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

    setLoading(true);
    try {
      // Combine date and time
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
    } catch (error) {
      console.error("Error updating appointment:", error);
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
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Erro ao cancelar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Agendamento</DialogTitle>
          <DialogDescription>
            Altere os detalhes do agendamento ou cancele-o.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <CustomerCombobox
              value={customerId}
              onChange={setCustomerId}
              onCustomerSelect={(c) => setCustomerName(c?.name || "")}
              onRequestCreate={() => {}} // Disable creation in edit mode for simplicity
              customerName={customerName}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-service">Serviço</Label>
            <select
              id="edit-service"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-time">Horário</Label>
              <Input
                id="edit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
            >
              Cancelar Agendamento
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
