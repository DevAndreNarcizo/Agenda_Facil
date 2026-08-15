import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export default function PortalBooking() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const orgId = localStorage.getItem("portal_organization_id");
    if (!orgId) return;

    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", orgId)
      .order("name");
    
    setServices(data || []);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBooking = async () => {
    const customerId = localStorage.getItem("portal_customer_id");
    const customerName = localStorage.getItem("portal_customer_name");
    const orgId = localStorage.getItem("portal_organization_id");

    if (!customerId || !customerName || !orgId || !selectedService || !date || !time) return;

    setLoading(true);
    try {
      const startDateTime = new Date(`${date}T${time}`);
      const duration = selectedService.duration_minutes || 30;
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      // Check availability using RPC
      const { data: isAvailable, error: availabilityError } = await supabase
        .rpc("check_availability", {
          p_start_time: startDateTime.toISOString(),
          p_end_time: endDateTime.toISOString(),
          p_organization_id: orgId
        });

      if (availabilityError) throw availabilityError;

      if (!isAvailable) {
        toast.error("Este horário não está disponível. Por favor, escolha outro.");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .insert({
          organization_id: orgId,
          customer_id: customerId,
          customer_name: customerName,
          service_id: selectedService.id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'pending' // Default to pending for self-scheduling
        });

      if (error) throw error;

      setStep(3); // Success step
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Error booking:", error);
      toast.error("Erro ao realizar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center space-y-8 py-12 text-center animate-in zoom-in-95 duration-700">
        <div className="relative">
            <div className="absolute inset-0 bg-stitch-primary/20 rounded-full blur-2xl animate-pulse"></div>
            <div className="relative h-24 w-24 bg-stitch-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-stitch-primary/40">
                <span className="material-symbols-outlined text-5xl font-black">check_circle</span>
            </div>
        </div>
        <div className="space-y-3">
          <h2 className="font-headline font-black text-3xl text-stitch-on-surface tracking-tight">Agendamento Solicitado!</h2>
          <p className="text-stitch-on-surface-variant font-medium opacity-60 max-w-[280px] mx-auto">
            Seu agendamento foi recebido e está pendente de confirmação.
          </p>
        </div>
        <div className="w-full pt-4">
            <Button 
                onClick={() => navigate("/portal")} 
                className="w-full h-16 bg-white text-stitch-on-surface border border-stitch-outline-variant/10 font-black rounded-2xl shadow-lg hover:bg-stitch-surface transition-all"
            >
                Voltar ao Início
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* Dynamic Header */}
      <div className="flex items-center gap-4">
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => step === 1 ? navigate("/portal") : setStep(step - 1)}
            className="w-12 h-12 rounded-2xl bg-white border border-stitch-outline-variant/10 shadow-sm hover:bg-stitch-surface"
        >
          <span className="material-symbols-outlined text-stitch-on-surface font-black">arrow_back</span>
        </Button>
        <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-stitch-primary opacity-60">Passo {step} de 2</span>
            <h1 className="font-headline font-black text-2xl text-stitch-on-surface tracking-tight">
                {step === 1 ? "O que vamos fazer?" : "Quando será?"}
            </h1>
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-4">
          {services.length === 0 ? (
             <div className="py-20 text-center space-y-2 opacity-40">
                <span className="material-symbols-outlined text-4xl">inventory_2</span>
                <p className="font-bold text-sm">Nenhum serviço disponível no momento.</p>
             </div>
          ) : (
            services.map((service) => (
              <div 
                key={service.id} 
                className="group bg-white rounded-[2rem] p-6 shadow-xl shadow-stitch-primary/[0.03] border border-stitch-outline-variant/5 hover:border-stitch-primary/30 hover:shadow-2xl hover:shadow-stitch-primary/10 hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden active:scale-[0.98]"
                onClick={() => handleServiceSelect(service)}
              >
                <div className="flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <h3 className="font-black text-stitch-on-surface text-lg group-hover:text-stitch-primary transition-colors">{service.name}</h3>
                    <div className="flex items-center gap-2 opacity-50">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        <span className="font-bold text-xs tracking-tight">{service.duration_minutes} min</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stitch-primary opacity-40 group-hover:opacity-100 transition-opacity">Investimento</span>
                    <div className="font-black text-xl text-stitch-on-surface tracking-tight">
                        R$ {service.price}
                    </div>
                  </div>
                </div>
                
                {/* Visual Accent */}
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-stitch-primary/0 group-hover:bg-stitch-primary/20 transition-all"></div>
              </div>
            ))
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 border border-stitch-outline-variant/10 shadow-xl shadow-stitch-primary/[0.03] space-y-6">
            <div className="flex items-center gap-4 p-4 bg-stitch-surface rounded-2xl border border-stitch-outline-variant/5">
                <div className="w-12 h-12 bg-stitch-primary/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-stitch-primary font-black">spa</span>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant opacity-50">Serviço</p>
                   <p className="font-black text-stitch-on-surface">{selectedService?.name}</p>
                </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant opacity-60 ml-1">Data do Agendamento</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant/40 group-focus-within:text-stitch-primary transition-colors">calendar_today</span>
                  <Input 
                    type="date" 
                    className="h-14 pl-12 rounded-2xl bg-stitch-surface border-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 font-bold transition-all"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant opacity-60 ml-1">Horário Desejado</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant/40 group-focus-within:text-stitch-primary transition-colors">schedule</span>
                  <Input 
                    type="time" 
                    className="h-14 pl-12 rounded-2xl bg-stitch-surface border-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 font-bold transition-all"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <Button 
            className="w-full h-16 bg-stitch-primary text-white font-black rounded-2xl shadow-2xl shadow-stitch-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-40" 
            onClick={handleBooking}
            disabled={!date || !time || loading}
          >
            {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    <span className="material-symbols-outlined font-black">check</span>
                    Confirmar Agendamento
                </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
