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
import { Calendar, CheckCircle, Clock, DollarSign, Phone, User } from "lucide-react";

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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5" />
            {customerName}
          </DialogTitle>
          <DialogDescription>
            Histórico e detalhes do cliente
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Customer Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center text-center">
              <DollarSign className="h-5 w-5 text-green-500 mb-2" />
              <span className="text-sm text-muted-foreground">LTV Total</span>
              <span className="text-lg font-bold">R$ {ltv.toFixed(2)}</span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center text-center">
              <CheckCircle className="h-5 w-5 text-blue-500 mb-2" />
              <span className="text-sm text-muted-foreground">Concluídos</span>
              <span className="text-lg font-bold">{completedCount}</span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg flex flex-col items-center justify-center text-center">
              <Calendar className="h-5 w-5 text-purple-500 mb-2" />
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{customerAppointments.length}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Contato</h4>
            <div className="flex flex-col gap-2">
              {customerPhone ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customerPhone}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">Telefone não informado</span>
              )}
            </div>
          </div>

          {/* Appointment History */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Histórico de Agendamentos</h4>
            {customerAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhum agendamento encontrado.</p>
            ) : (
              <div className="space-y-3">
                {customerAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{apt.service?.name || "Serviço"}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            apt.status === "completed"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : apt.status === "cancelled"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : apt.status === "confirmed"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(apt.start_time), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        <Clock className="h-3 w-3 ml-2" />
                        {format(new Date(apt.start_time), "HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="font-medium">
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
