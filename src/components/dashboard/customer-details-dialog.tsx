import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Appointment } from "@/hooks/use-appointments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomerDetailsDialogProps {
  customerName: string;
  customerPhone?: string;
  appointments: Appointment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailsDialog({
  customerName,
  customerPhone,
  appointments,
  open,
  onOpenChange,
}: CustomerDetailsDialogProps) {
  // Filter appointments for this customer
  const customerAppointments = appointments
    .filter((apt) => apt.customer_name === customerName)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  // Calculate LTV (Lifetime Value) - Sum of prices of completed appointments
  const ltv = customerAppointments
    .filter((apt) => apt.status === "completed")
    .reduce((total, apt) => total + (apt.service?.price || 0), 0);

  const completedCount = customerAppointments.filter((apt) => apt.status === "completed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto rounded-[2.5rem] border-none shadow-2xl p-0 font-sans">
        <DialogHeader className="p-8 pb-4 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">person</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-stitch-on-surface leading-tight">
                {customerName}
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Histórico e detalhes do cliente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-8 py-6 space-y-8">
          {/* Customer Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-stitch-surface-container-low/50 p-5 rounded-[1.5rem] flex flex-col items-center justify-center text-center border border-stitch-outline-variant/5">
              <span className="material-symbols-outlined text-stitch-primary mb-2 text-2xl">payments</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-stitch-on-surface-variant opacity-40">LTV Total</span>
              <span className="text-lg font-black text-stitch-on-surface">R$ {ltv.toFixed(2)}</span>
            </div>
            <div className="bg-stitch-surface-container-low/50 p-5 rounded-[1.5rem] flex flex-col items-center justify-center text-center border border-stitch-outline-variant/5">
              <span className="material-symbols-outlined text-stitch-primary mb-2 text-2xl">check_circle</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-stitch-on-surface-variant opacity-40">Concluídos</span>
              <span className="text-lg font-black text-stitch-on-surface">{completedCount}</span>
            </div>
            <div className="bg-stitch-surface-container-low/50 p-5 rounded-[1.5rem] flex flex-col items-center justify-center text-center border border-stitch-outline-variant/5">
              <span className="material-symbols-outlined text-stitch-primary mb-2 text-2xl">calendar_today</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-stitch-on-surface-variant opacity-40">Total</span>
              <span className="text-lg font-black text-stitch-on-surface">{customerAppointments.length}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-stitch-on-surface-variant/40 uppercase tracking-[0.2em] ml-1">Contato</h4>
            <div className="flex items-center p-4 rounded-2xl bg-stitch-surface-container-low/30 border border-stitch-outline-variant/5">
              {customerPhone ? (
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-stitch-primary">call</span>
                  <span className="font-bold text-stitch-on-surface">{customerPhone}</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-stitch-on-surface-variant opacity-40 italic">Telefone não informado</span>
              )}
            </div>
          </div>

          {/* Appointment History */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-stitch-on-surface-variant/40 uppercase tracking-[0.2em] ml-1">Histórico de Agendamentos</h4>
            {customerAppointments.length === 0 ? (
              <div className="text-center py-12 rounded-3xl bg-stitch-surface-container-lowest border-2 border-dashed border-stitch-outline-variant/20">
                <span className="material-symbols-outlined text-4xl text-stitch-on-surface-variant/20 mb-2">event_busy</span>
                <p className="text-sm font-bold text-stitch-on-surface-variant opacity-40">Nenhum agendamento encontrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customerAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white border border-stitch-outline-variant/10 hover:shadow-md transition-all group"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-stitch-on-surface">{apt.service?.name || "Serviço"}</span>
                        <span
                          className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                            apt.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : apt.status === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : apt.status === "confirmed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {apt.status === "completed"
                            ? "Concluído"
                            : apt.status === "cancelled"
                            ? "Cancelado"
                            : apt.status === "confirmed"
                            ? "Confirmado"
                            : "Pendente"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold text-stitch-on-surface-variant opacity-60">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          {format(new Date(apt.start_time), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          {format(new Date(apt.start_time), "HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-black text-stitch-primary">
                      R$ {apt.service?.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
