import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWaitlist } from "@/hooks/use-waitlist";
import { useEmployees } from "@/hooks/use-employees";
import { CustomerCombobox } from "./customer-combobox";
import { NewCustomerDialog } from "./new-customer-dialog";
import { format } from "date-fns";
import { CalendarClock, CheckCircle, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export function WaitlistDialog() {
  const [open, setOpen] = useState(false);
  const { waitlist, addToWaitlist, updateStatus, deleteEntry } = useWaitlist();
  const { employees } = useEmployees();
  const { profile } = useAuth();
  
  // Need services to select service
  const [services, setServices] = useState<any[]>([]);
  
  // Form State
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // New Customer Dialog
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [pendingCustomerName, setPendingCustomerName] = useState("");

  // Fetch services on open
  const fetchServices = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", profile.organization_id);
    setServices(data || []);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) fetchServices();
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
    if (!customerId || !date) return;

    setLoading(true);
    try {
      await addToWaitlist({
        customer_id: customerId,
        service_id: serviceId || undefined,
        employee_id: employeeId || undefined,
        desired_date: date,
        notes,
        status: "pending",
        organization_id: profile?.organization_id || "", // Hook handles this usually but type requires it? No, hook omits it.
        // Wait, hook type Omit<WaitlistEntry, "id" | "created_at" | "customer" | "service" | "employee">
        // organization_id is in WaitlistEntry? No, I didn't add it to interface but it is in DB.
        // Let's check hook interface.
      } as any); 

      // Reset form
      setCustomerId("");
      setServiceId("");
      setEmployeeId("");
      setDate("");
      setNotes("");
      // Switch to list tab? Or just show success.
    } catch (error) {
      console.error("Error adding to waitlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const pendingEntries = waitlist.filter(w => w.status === 'pending');
  const otherEntries = waitlist.filter(w => w.status !== 'pending');

  return (
    <>
      <NewCustomerDialog
        open={newCustomerDialogOpen}
        onOpenChange={setNewCustomerDialogOpen}
        initialName={pendingCustomerName}
        onCreateCustomer={handleCreateCustomer}
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Lista de Espera
            {pendingEntries.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingEntries.length}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista de Espera</DialogTitle>
            <DialogDescription>
              Gerencie clientes aguardando por um horário.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Aguardando ({pendingEntries.length})</TabsTrigger>
              <TabsTrigger value="add">Adicionar Novo</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              {pendingEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ninguém na lista de espera.</p>
              ) : (
                <div className="space-y-2">
                  {pendingEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div>
                        <p className="font-medium">{entry.customer?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.desired_date), "dd/MM/yyyy")}
                          {entry.service && ` - ${entry.service.name}`}
                          {entry.employee && ` (${entry.employee.full_name})`}
                        </p>
                        {entry.notes && <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => updateStatus({ id: entry.id, status: "contacted" })}
                          title="Marcar como contatado"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteEntry(entry.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {otherEntries.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Histórico Recente</h4>
                  <div className="space-y-2 opacity-60">
                    {otherEntries.slice(0, 5).map((entry) => (
                       <div key={entry.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                         <span>{entry.customer?.name} - {entry.status}</span>
                         <span className="text-xs">{format(new Date(entry.created_at), "dd/MM")}</span>
                       </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="add">
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Data Desejada</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Profissional (Opcional)</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    >
                      <option value="">Qualquer</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Serviço (Opcional)</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Observações</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Preferência pela manhã..."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Adicionando..." : "Adicionar à Lista"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
