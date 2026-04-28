import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description?: string;
}

interface Employee {
  id: string;
  full_name: string;
}

type BookingStep = "idle" | "datetime" | "confirm" | "success";

export default function PublicPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Booking state
  const [bookingStep, setBookingStep] = useState<BookingStep>("idle");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;

    const fetchOrg = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, primary_color, secondary_color, accent_color")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setOrg(data);

      // Buscar serviços e profissionais em paralelo
      const [servicesRes, employeesRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price, duration_minutes, description")
          .eq("organization_id", data.id)
          .order("name"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("organization_id", data.id)
          .order("full_name"),
      ]);

      setServices(servicesRes.data || []);
      setEmployees(employeesRes.data || []);
      setLoading(false);
    };

    fetchOrg();
  }, [slug]);

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setBookingStep("datetime");
    // Scroll to booking section
    setTimeout(() => {
      document.getElementById("booking-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Selecione uma data e horário.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Informe seu telefone.");
      return;
    }
    setBookingStep("confirm");
  };

  const handleSubmitBooking = async () => {
    if (!org || !selectedService) return;

    setSubmitting(true);
    try {
      const startTime = `${selectedDate}T${selectedTime}:00`;
      const endMinutes = selectedService.duration_minutes;
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + endMinutes * 60000);
      const endTime = endDate.toISOString();

      const { error } = await supabase.from("appointments").insert({
        organization_id: org.id,
        service_id: selectedService.id,
        employee_id: selectedEmployee || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        start_time: startTime,
        end_time: endTime,
        status: "pending",
        payment_status: "pending",
        amount_paid: 0,
      });

      if (error) throw error;

      setBookingStep("success");
    } catch {
      toast.error("Erro ao criar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setBookingStep("idle");
    setSelectedService(null);
    setSelectedEmployee("");
    setSelectedDate("");
    setSelectedTime("");
    setCustomerName("");
    setCustomerPhone("");
  };

  const getTodayMin = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Theme classes
  const bg = darkMode ? "bg-[#0f1113]" : "bg-gray-50";
  const cardBg = darkMode ? "bg-[#1d2023]" : "bg-white";
  const cardBorder = darkMode ? "border-white/10" : "border-gray-100";
  const textPrimary = darkMode ? "text-white" : "text-gray-900";
  const textSecondary = darkMode ? "text-gray-400" : "text-gray-500";
  const textMuted = darkMode ? "text-gray-500" : "text-gray-400";
  const headerBg = darkMode ? "bg-[#0f1113]/80" : "bg-white/80";
  const headerBorder = darkMode ? "border-white/5" : "border-gray-100";
  const footerBg = darkMode ? "bg-[#1d2023]" : "bg-white";
  const inputBg = darkMode ? "bg-[#282a2d] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900";
  const dividerColor = darkMode ? "border-white/5" : "border-gray-50";

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bg}`}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className={`${textSecondary} font-medium`}>Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bg}`}>
        <div className="text-center space-y-4 max-w-md mx-auto px-6">
          <span className="material-symbols-outlined text-6xl text-gray-300">search_off</span>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Portal não encontrado</h1>
          <p className={textSecondary}>O endereço que você acessou não corresponde a nenhum negócio cadastrado.</p>
        </div>
      </div>
    );
  }

  const primary = org.primary_color || "#5343d4";
  const secondary = org.secondary_color || "#00616f";
  const accent = org.accent_color || "#ae5b70";

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-300`} style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className={`sticky top-0 z-50 ${headerBg} backdrop-blur-xl border-b ${headerBorder} transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: primary }}>
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className={`text-lg font-bold ${textPrimary}`}>{org.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Dark/Light toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${darkMode ? "bg-white/10 text-yellow-400" : "bg-gray-100 text-gray-600"}`}
            >
              <span className="material-symbols-outlined text-xl">
                {darkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className={`text-xs font-semibold ${textMuted} uppercase tracking-wide`}>Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center relative z-10">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-6 shadow-lg" />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-lg" style={{ backgroundColor: primary }}>
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className={`text-4xl font-black ${textPrimary} mb-3 tracking-tight`}>{org.name}</h2>
          <p className={`text-lg ${textSecondary} max-w-lg mx-auto mb-8`}>
            Agende seu horário de forma rápida e prática. Escolha o serviço ideal para você.
          </p>
          <Button
            className="h-14 px-10 rounded-2xl font-bold text-lg text-white shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: primary }}
            onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
          >
            <span className="material-symbols-outlined mr-2">calendar_month</span>
            Ver Serviços e Agendar
          </Button>
        </div>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ backgroundColor: primary }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-10 pointer-events-none" style={{ backgroundColor: secondary }} />
      </section>

      {/* Serviços */}
      <section id="services" className="max-w-4xl mx-auto px-6 pb-12">
        <div className="mb-8">
          <h3 className={`text-2xl font-bold ${textPrimary} mb-1`}>Nossos Serviços</h3>
          <p className={textSecondary}>Selecione um serviço para agendar seu horário</p>
        </div>

        {services.length === 0 ? (
          <div className={`text-center py-16 ${cardBg} rounded-3xl border ${cardBorder} transition-colors`}>
            <span className="material-symbols-outlined text-5xl text-gray-300 block mb-4">spa</span>
            <p className={`${textSecondary} font-medium`}>Nenhum serviço disponível no momento.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => {
              const isSelected = selectedService?.id === service.id && bookingStep !== "idle";
              return (
                <div
                  key={service.id}
                  className={`${cardBg} rounded-2xl border ${isSelected ? "border-2 ring-2 ring-opacity-30" : cardBorder} p-6 hover:shadow-lg transition-all group`}
                  style={isSelected ? { borderColor: primary, boxShadow: `0 0 0 2px ${primary}33` } : undefined}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primary}15` }}>
                      <span className="material-symbols-outlined text-xl" style={{ color: primary }}>content_cut</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ backgroundColor: `${accent}15`, color: accent }}>
                      {service.duration_minutes}min
                    </span>
                  </div>
                  <h4 className={`text-lg font-bold ${textPrimary} mb-1`}>{service.name}</h4>
                  {service.description && (
                    <p className={`text-sm ${textSecondary} mb-4 line-clamp-2`}>{service.description}</p>
                  )}
                  <div className={`flex items-center justify-between mt-4 pt-4 border-t ${dividerColor}`}>
                    <span className="text-2xl font-black" style={{ color: primary }}>
                      R$ {service.price.toFixed(2).replace(".", ",")}
                    </span>
                    <Button
                      size="sm"
                      className="rounded-xl font-bold text-white px-6 transition-all hover:scale-105"
                      style={{ backgroundColor: primary }}
                      onClick={() => handleSelectService(service)}
                    >
                      {isSelected ? "Selecionado" : "Agendar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Booking Section */}
      {bookingStep !== "idle" && selectedService && (
        <section id="booking-section" className="max-w-4xl mx-auto px-6 pb-20">
          <div className={`${cardBg} rounded-3xl border ${cardBorder} p-8 shadow-xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-500`}>

            {/* Step: Date & Time */}
            {bookingStep === "datetime" && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-2xl font-bold ${textPrimary}`}>Agendar: {selectedService.name}</h3>
                    <p className={textSecondary}>
                      {selectedService.duration_minutes}min — R$ {selectedService.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <button onClick={resetBooking} className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200"} transition-all`}>
                    <span className="material-symbols-outlined text-xl" style={{ color: textSecondary }}>close</span>
                  </button>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className={`text-sm font-bold ${textSecondary} uppercase tracking-wider`}>Seu Nome</label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nome completo"
                      className={`h-14 rounded-xl font-medium ${inputBg}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-sm font-bold ${textSecondary} uppercase tracking-wider`}>Seu Telefone</label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className={`h-14 rounded-xl font-medium ${inputBg}`}
                    />
                  </div>
                </div>

                {employees.length > 0 && (
                  <div className="space-y-2">
                    <label className={`text-sm font-bold ${textSecondary} uppercase tracking-wider`}>Profissional (opcional)</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className={`w-full h-14 rounded-xl px-4 font-medium ${inputBg} appearance-none cursor-pointer`}
                    >
                      <option value="">Qualquer profissional disponível</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className={`text-sm font-bold ${textSecondary} uppercase tracking-wider`}>Data</label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={getTodayMin()}
                      className={`h-14 rounded-xl font-medium ${inputBg}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-sm font-bold ${textSecondary} uppercase tracking-wider`}>Horário</label>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      min="07:00"
                      max="21:00"
                      className={`h-14 rounded-xl font-medium ${inputBg}`}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" onClick={resetBooking} className={`h-14 px-8 rounded-xl font-bold ${darkMode ? "border-white/10 text-white hover:bg-white/5" : ""}`}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    className="h-14 px-10 rounded-xl font-bold text-white flex-1 transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: primary }}
                  >
                    Revisar Agendamento
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Confirm */}
            {bookingStep === "confirm" && (
              <div className="space-y-8">
                <div>
                  <h3 className={`text-2xl font-bold ${textPrimary} mb-1`}>Confirmar Agendamento</h3>
                  <p className={textSecondary}>Revise os dados antes de confirmar.</p>
                </div>

                <div className={`rounded-2xl p-6 space-y-4 ${darkMode ? "bg-white/5" : "bg-gray-50"}`}>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Serviço</span>
                    <span className={`font-bold ${textPrimary}`}>{selectedService.name}</span>
                  </div>
                  <div className={`border-t ${dividerColor}`} />
                  <div className="flex justify-between">
                    <span className={textSecondary}>Data</span>
                    <span className={`font-bold ${textPrimary}`}>
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                  <div className={`border-t ${dividerColor}`} />
                  <div className="flex justify-between">
                    <span className={textSecondary}>Horário</span>
                    <span className={`font-bold ${textPrimary}`}>{selectedTime}</span>
                  </div>
                  <div className={`border-t ${dividerColor}`} />
                  <div className="flex justify-between">
                    <span className={textSecondary}>Duração</span>
                    <span className={`font-bold ${textPrimary}`}>{selectedService.duration_minutes} minutos</span>
                  </div>
                  <div className={`border-t ${dividerColor}`} />
                  <div className="flex justify-between">
                    <span className={textSecondary}>Cliente</span>
                    <span className={`font-bold ${textPrimary}`}>{customerName}</span>
                  </div>
                  <div className={`border-t ${dividerColor}`} />
                  <div className="flex justify-between">
                    <span className={textSecondary}>Telefone</span>
                    <span className={`font-bold ${textPrimary}`}>{customerPhone}</span>
                  </div>
                  {selectedEmployee && employees.length > 0 && (
                    <>
                      <div className={`border-t ${dividerColor}`} />
                      <div className="flex justify-between">
                        <span className={textSecondary}>Profissional</span>
                        <span className={`font-bold ${textPrimary}`}>{employees.find(e => e.id === selectedEmployee)?.full_name}</span>
                      </div>
                    </>
                  )}
                  <div className={`border-t-2 ${dividerColor}`} />
                  <div className="flex justify-between items-center">
                    <span className={`font-bold ${textSecondary}`}>Valor</span>
                    <span className="text-2xl font-black" style={{ color: primary }}>
                      R$ {selectedService.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setBookingStep("datetime")} className={`h-14 px-8 rounded-xl font-bold ${darkMode ? "border-white/10 text-white hover:bg-white/5" : ""}`}>
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSubmitBooking}
                    disabled={submitting}
                    className="h-14 px-10 rounded-xl font-bold text-white flex-1 transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: primary }}
                  >
                    {submitting ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Agendando...
                      </div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined mr-2">check_circle</span>
                        Confirmar Agendamento
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Success */}
            {bookingStep === "success" && (
              <div className="text-center py-8 space-y-6">
                <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
                  <span className="material-symbols-outlined text-4xl" style={{ color: primary }}>check_circle</span>
                </div>
                <div>
                  <h3 className={`text-2xl font-black ${textPrimary} mb-2`}>Agendamento Realizado!</h3>
                  <p className={`${textSecondary} max-w-md mx-auto`}>
                    Seu agendamento para <strong>{selectedService.name}</strong> foi enviado com sucesso.
                    Você receberá uma confirmação em breve.
                  </p>
                </div>
                <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold ${darkMode ? "bg-white/5 text-white" : "bg-gray-100 text-gray-700"}`}>
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} às {selectedTime}
                </div>
                <div>
                  <Button
                    onClick={resetBooking}
                    className="h-14 px-10 rounded-xl font-bold text-white transition-all hover:scale-105"
                    style={{ backgroundColor: primary }}
                  >
                    Fazer Novo Agendamento
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className={`border-t ${headerBorder} ${footerBg} py-8 transition-colors duration-300`}>
        <div className={`max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm ${textMuted}`}>
          <p>
            Agendamento online por <span className="font-bold" style={{ color: primary }}>AgendaFácil</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">lock</span>
            Conexão segura
          </div>
        </div>
      </footer>
    </div>
  );
}
