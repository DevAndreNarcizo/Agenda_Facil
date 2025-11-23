import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Plus, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function PortalHome() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    const customerId = localStorage.getItem("portal_customer_id");
    if (!customerId) return;

    try {
      const { data, error } = await supabase
        .rpc("get_customer_appointments", { p_customer_id: customerId });

      if (error) throw error;
      
      // Map RPC result to expected format
      const formattedData = (data || []).map((apt: any) => ({
        id: apt.id,
        start_time: apt.start_time,
        end_time: apt.end_time,
        status: apt.status,
        service: {
          name: apt.service_name,
          price: apt.service_price,
          duration_minutes: apt.service_duration
        }
      }));

      setAppointments(formattedData);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingAppointments = appointments.filter(
    (apt) => new Date(apt.start_time) >= new Date() && apt.status !== 'cancelled'
  ).reverse(); // Show closest first

  const pastAppointments = appointments.filter(
    (apt) => new Date(apt.start_time) < new Date() || apt.status === 'cancelled'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Meus Agendamentos</h1>
        <Button 
          className="w-full" 
          size="lg"
          onClick={() => navigate("/portal/book")}
        >
          <Plus className="mr-2 h-5 w-5" />
          Novo Agendamento
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Próximos
        </h2>
        
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : upcomingAppointments.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              Você não tem agendamentos futuros.
            </CardContent>
          </Card>
        ) : (
          upcomingAppointments.map((apt) => (
            <Card key={apt.id} className="overflow-hidden">
              <div className="h-2 bg-primary" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{apt.service?.name}</CardTitle>
                  <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>
                    {apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(apt.start_time), "dd 'de' MMMM", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(new Date(apt.start_time), "HH:mm")}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
          <History className="h-5 w-5" />
          Histórico
        </h2>
        
        <div className="space-y-3">
          {pastAppointments.slice(0, 5).map((apt) => (
            <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
              <div>
                <p className="font-medium text-sm">{apt.service?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(apt.start_time), "dd/MM/yy HH:mm")}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {apt.status === 'completed' ? 'Concluído' : apt.status === 'cancelled' ? 'Cancelado' : apt.status}
              </Badge>
            </div>
          ))}
          {pastAppointments.length === 0 && !loading && (
             <p className="text-muted-foreground text-sm">Nenhum histórico disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
}
