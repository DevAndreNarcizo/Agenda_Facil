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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function WaitlistDialog() {
  const [open, setOpen] = useState(false);
  const { waitlist, addToWaitlist, updateStatus, deleteEntry } = useWaitlist();
  const { employees } = useEmployees();
  const { profile } = useAuth();
  
  // Need services to select service
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  
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
    } catch {
      // Error handled by form
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
      }); 

      // Reset form
      setCustomerId("");
      setServiceId("");
      setEmployeeId("");
      setDate("");
      setNotes("");
      toast.success("Cliente adicionado à lista de espera!");
    } catch {
      toast.error("Erro ao adicionar à lista de espera.");
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
          <Button variant="outline" className="h-14 px-6 rounded-xl font-bold gap-3 border-2 border-stitch-outline-variant/20 hover:bg-stitch-primary/5 hover:text-stitch-primary transition-all">
            <span className="material-symbols-outlined">event_repeat</span>
            Lista de Espera
            {pendingEntries.length > 0 && (
              <span className="bg-stitch-error text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {pendingEntries.length}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
          <DialogHeader className="p-8 pb-4 bg-stitch-surface-container-low/30">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
                <span className="material-symbols-outlined text-3xl">event_repeat</span>
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-stitch-on-surface">Lista de Espera</DialogTitle>
                <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                  Gerencie clientes aguardando por um horário.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 pb-8">
            <Tabs defaultValue="list" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-stitch-surface-container-low/50 rounded-2xl">
                <TabsTrigger value="list" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Aguardando ({pendingEntries.length})
                </TabsTrigger>
                <TabsTrigger value="add" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Adicionar Novo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="space-y-6 mt-6">
                {pendingEntries.length === 0 ? (
                  <div className="text-center py-16 rounded-3xl bg-stitch-surface-container-lowest border-2 border-dashed border-stitch-outline-variant/20">
                    <span className="material-symbols-outlined text-5xl text-stitch-on-surface-variant/20 mb-3">person_search</span>
                    <p className="font-bold text-stitch-on-surface-variant opacity-40">Ninguém na lista de espera.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white border border-stitch-outline-variant/10 hover:shadow-md transition-all group">
                        <div className="flex flex-col gap-1">
                          <p className="font-black text-stitch-on-surface leading-tight">{entry.customer?.name}</p>
                          <div className="flex items-center gap-3 text-xs font-bold text-stitch-on-surface-variant opacity-60">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">calendar_today</span>
                              {format(new Date(entry.desired_date), "dd/MM/yyyy")}
                            </span>
                            {entry.service && <span>• {entry.service.name}</span>}
                            {entry.employee && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-stitch-primary">person</span>
                                {entry.employee.full_name}
                              </span>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="text-[10px] font-medium text-stitch-on-surface-variant opacity-40 italic mt-1 px-3 py-1 bg-stitch-surface-container-low/50 rounded-lg w-fit">
                              "{entry.notes}"
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-10 h-10 rounded-xl text-stitch-primary bg-stitch-primary/5 hover:bg-stitch-primary/10"
                            onClick={() => updateStatus({ id: entry.id, status: "contacted" })}
                            title="Marcar como contatado"
                          >
                            <span className="material-symbols-outlined text-xl font-bold">check_circle</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-10 h-10 rounded-xl text-stitch-error bg-stitch-error/5 hover:bg-stitch-error/10"
                            onClick={() => deleteEntry(entry.id)}
                            title="Remover"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {otherEntries.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-stitch-outline-variant/10">
                    <h4 className="text-[10px] font-black text-stitch-on-surface-variant/40 uppercase tracking-[0.2em] mb-4 ml-1">Histórico Recente</h4>
                    <div className="space-y-2">
                      {otherEntries.slice(0, 5).map((entry) => (
                         <div key={entry.id} className="flex items-center justify-between p-4 rounded-xl bg-stitch-surface-container-lowest/50 text-sm border border-stitch-outline-variant/5">
                           <div className="flex items-center gap-2">
                             <span className="font-bold text-stitch-on-surface opacity-60">{entry.customer?.name}</span>
                             <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stitch-outline-variant/10 text-stitch-on-surface-variant opacity-60">
                               {entry.status}
                             </span>
                           </div>
                           <span className="text-xs font-black text-stitch-on-surface-variant/30">{format(new Date(entry.created_at), "dd/MM")}</span>
                         </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="add" className="mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold ml-1">Data Desejada</Label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">event</span>
                        <Input
                          type="date"
                          className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold ml-1">Profissional (Opcional)</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">person</span>
                        <select
                          className="flex h-14 w-full pl-12 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none"
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value)}
                        >
                          <option value="">Qualquer profissional</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                          ))}
                        </select>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 pointer-events-none">unfold_more</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Serviço (Opcional)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">content_cut</span>
                      <select
                        className="flex h-14 w-full pl-12 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                      >
                        <option value="">Qualquer serviço</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 pointer-events-none">unfold_more</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Observações</Label>
                    <div className="relative group">
                      <span className="absolute left-4 top-4 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">notes</span>
                      <Input
                        className="pl-12 h-20 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Preferência pela manhã, ligar se houver desistência..."
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Adicionando...
                      </span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">person_add</span>
                        Adicionar à Lista
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
