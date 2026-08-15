import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { getPortalAppointments, type PortalAppointment } from "@/lib/portal-api";

export default function PortalHome() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  /**
   * Carrega os agendamentos pelo gateway autenticado do portal.
   *
   * @author André Narcizo
   */
  const fetchAppointments = async (): Promise<void> => {
    try {
      setAppointments(await getPortalAppointments());
    } catch (error: unknown) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingAppointments = appointments.filter(
    (apt) => new Date(apt.start_time) >= new Date() && apt.status !== 'cancelled'
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pastAppointments = appointments.filter(
    (apt) => new Date(apt.start_time) < new Date() || apt.status === 'cancelled'
  ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Action Header */}
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline font-black text-4xl text-stitch-on-surface tracking-tight">Meus Agendamentos</h1>
          <p className="text-stitch-on-surface-variant font-medium opacity-60">Gerencie seus horários e serviços.</p>
        </div>
        
        <Button 
          className="w-full h-16 bg-stitch-primary text-white font-black rounded-2xl shadow-xl shadow-stitch-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg group"
          onClick={() => navigate("/portal/book")}
        >
          <span className="material-symbols-outlined text-2xl font-black transition-transform group-hover:rotate-90">add</span>
          Novo Agendamento
        </Button>
      </div>

      {/* Upcoming Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-headline font-black text-xl text-stitch-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-stitch-primary">event</span>
            Próximos
          </h2>
          {upcomingAppointments.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-stitch-primary/60 bg-stitch-primary/5 px-3 py-1 rounded-full">
              {upcomingAppointments.length} AGENDADO{upcomingAppointments.length !== 1 ? 'S' : ''}
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="bg-white/40 border-2 border-dashed border-stitch-outline-variant/20 rounded-[2rem] py-16 px-8 text-center space-y-4">
             <div className="inline-flex items-center justify-center w-16 h-16 bg-stitch-surface rounded-2xl mb-2 opacity-50">
                <span className="material-symbols-outlined text-stitch-outline text-3xl">event_busy</span>
             </div>
             <div className="space-y-1">
                <p className="font-bold text-stitch-on-surface opacity-60">Nenhum agendamento futuro</p>
                <p className="text-xs text-stitch-on-surface-variant opacity-50">Que tal marcar um serviço agora?</p>
             </div>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.map((apt) => (
              <div 
                key={apt.id} 
                className="group bg-white rounded-[2rem] p-6 shadow-xl shadow-stitch-primary/[0.03] border border-stitch-outline-variant/10 hover:shadow-2xl hover:shadow-stitch-primary/10 hover:scale-[1.01] transition-all relative overflow-hidden"
              >
                {/* Status Bar */}
                <div className="absolute top-0 left-0 w-2 h-full bg-stitch-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stitch-primary opacity-60">Serviço</span>
                      <h3 className="font-headline font-black text-xl text-stitch-on-surface leading-tight">
                        {apt.services?.name}
                      </h3>
                    </div>
                    <Badge className="rounded-xl px-4 py-1 bg-stitch-primary/10 text-stitch-primary border-none font-bold text-[10px] uppercase tracking-widest">
                      {apt.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6 pt-2 border-t border-stitch-outline-variant/5">
                    <div className="flex items-center gap-2 group/info">
                      <div className="w-8 h-8 rounded-xl bg-stitch-surface flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg text-stitch-on-surface-variant">calendar_today</span>
                      </div>
                      <span className="font-bold text-sm text-stitch-on-surface tracking-tight">
                        {format(new Date(apt.start_time), "dd 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-xl bg-stitch-surface flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg text-stitch-on-surface-variant">schedule</span>
                      </div>
                      <span className="font-bold text-sm text-stitch-on-surface tracking-tight">
                        {format(new Date(apt.start_time), "HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="space-y-6 pt-2">
        <h2 className="font-headline font-black text-xl text-stitch-on-surface-variant opacity-40 flex items-center gap-2 px-1">
          <span className="material-symbols-outlined">history</span>
          Histórico
        </h2>
        
        <div className="bg-white/40 rounded-[2.5rem] border border-stitch-outline-variant/10 divide-y divide-stitch-outline-variant/5">
          {pastAppointments.length === 0 && !loading ? (
             <p className="py-12 text-center text-sm font-bold text-stitch-on-surface-variant opacity-30">Nenhum registro anterior.</p>
          ) : (
            pastAppointments.slice(0, 5).map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-6 hover:bg-white transition-colors first:rounded-t-[2.5rem] last:rounded-b-[2.5rem]">
                <div className="space-y-1">
                  <p className="font-black text-stitch-on-surface text-sm tracking-tight">{apt.services?.name}</p>
                  <p className="text-[10px] font-bold text-stitch-on-surface-variant opacity-50 uppercase tracking-widest">
                    {format(new Date(apt.start_time), "dd/MM/yy 'às' HH:mm")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-stitch-outline-variant/20 text-stitch-on-surface-variant opacity-60 rounded-lg">
                    {apt.status === 'completed' ? 'Concluído' : apt.status === 'cancelled' ? 'Cancelado' : apt.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
