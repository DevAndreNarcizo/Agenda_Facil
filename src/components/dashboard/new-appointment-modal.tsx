import { useState, useEffect } from "react";
// import { z } from "zod"; // Removed unused import

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
import { CustomerCombobox } from "./customer-combobox"; // Removed unused type Customer
import { NewCustomerDialog } from "./new-customer-dialog";

// Simplified form handling without the full shadcn Form component for now to save time/complexity
// unless we want to implement the full Form suite. Let's stick to standard controlled inputs for speed.

// Schema definition removed as it was unused. 
// Validation is currently done manually in handleSubmit.
// const appointmentSchema = z.object({
//   customerId: z.string().min(1, "Selecione um cliente"),
//   serviceId: z.string().min(1, "Selecione um serviço"),
//   date: z.string().min(1, "Selecione uma data"),
//   time: z.string().min(1, "Selecione um horário"),
// });

// type AppointmentForm = z.infer<typeof appointmentSchema>;

interface NewAppointmentModalProps {
  onAppointmentCreated: () => void;
}

export function NewAppointmentModal({ onAppointmentCreated }: NewAppointmentModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const { profile } = useAuth();

  // Form State
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState(""); // For display/creation
  const [serviceId, setServiceId] = useState("");
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
    } catch (error) {
      console.error("Error creating customer:", error);
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

      const { error } = await supabase
        .from("appointments")
        .insert({
          organization_id: profile.organization_id,
          customer_id: customerId,
          customer_name: customerName, // Keep for cache/legacy
          service_id: serviceId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed'
        });

      if (error) throw error;

      setOpen(false);
      onAppointmentCreated();
      // Reset form
      setCustomerId("");
      setServiceId("");
      setDate("");
      setTime("");
    } catch (error) {
      console.error("Error creating appointment:", error);
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
