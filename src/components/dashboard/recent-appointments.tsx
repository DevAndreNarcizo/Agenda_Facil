import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Appointment } from "@/hooks/use-appointments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, User } from "lucide-react";

// Props do componente
interface RecentAppointmentsProps {
  appointments: Appointment[]; // Lista de agendamentos
}

export function RecentAppointments({ appointments }: RecentAppointmentsProps) {
  // Pegar os próximos 5 agendamentos (ordenados por data)
  const upcomingAppointments = appointments
    .filter((apt) => new Date(apt.scheduled_at) >= new Date() && apt.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  // Badge de status
  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }[status] || "bg-gray-100 text-gray-800";

    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
    }[status] || status;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles}`}>
        {labels}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos Agendamentos</CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum agendamento próximo
          </p>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-start justify-between border-b pb-4 last:border-b-0 last:pb-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{apt.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(apt.scheduled_at), "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(apt.scheduled_at), "HH:mm")}</span>
                    <span className="mx-1">•</span>
                    <span>{apt.service?.name || "Serviço"}</span>
                  </div>
                </div>
                <div>{getStatusBadge(apt.status)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
