import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, Clock, Check } from "lucide-react";
import { toast } from "sonner";

export default function PortalBooking() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  
  const [selectedService, setSelectedService] = useState<any>(null);
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

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setStep(2);
  };

  const handleBooking = async () => {
    const customerId = localStorage.getItem("portal_customer_id");
    const customerName = localStorage.getItem("portal_customer_name");
    const orgId = localStorage.getItem("portal_organization_id");

    if (!customerId || !orgId || !selectedService || !date || !time) return;

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
    } catch (error) {
      console.error("Error booking:", error);
      toast.error("Erro ao realizar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-10 text-center">
        <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
          <Check className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Agendamento Solicitado!</h2>
          <p className="text-muted-foreground">
            Seu agendamento foi recebido e está pendente de confirmação.
          </p>
        </div>
        <Button onClick={() => navigate("/portal")} className="w-full">
          Voltar para Meus Agendamentos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate("/portal") : setStep(step - 1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">
          {step === 1 ? "Escolha o Serviço" : "Escolha o Horário"}
        </h1>
      </div>

      {step === 1 && (
        <div className="grid gap-3">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => handleServiceSelect(service)}
            >
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-sm text-muted-foreground">{service.duration_minutes} min</p>
                </div>
                <div className="font-bold text-primary">
                  R$ {service.price}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Serviço Selecionado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="font-medium">{selectedService?.name}</span>
                <span>R$ {selectedService?.price}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  className="pl-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Horário</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="time" 
                  className="pl-9"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button 
            className="w-full" 
            size="lg" 
            onClick={handleBooking}
            disabled={!date || !time || loading}
          >
            {loading ? "Agendando..." : "Confirmar Agendamento"}
          </Button>
        </div>
      )}
    </div>
  );
}
