import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Appointment } from "@/hooks/use-appointments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { CustomerDetailsDialog } from "./customer-details-dialog";
import { ReviewDialog } from "./review-dialog";
import { PaymentModal } from "./payment-modal";
import { toast } from "sonner";

interface RecentAppointmentsProps {
  appointments: Appointment[];
  onUpdateStatus: (id: string, status: "completed" | "cancelled" | "confirmed") => Promise<void>;
}

export function RecentAppointments({ appointments, onUpdateStatus }: RecentAppointmentsProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedAppointmentForReview, setSelectedAppointmentForReview] = useState<Appointment | null>(null);
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState<Appointment | null>(null);

  // Sort by date (ascending - oldest/nearest first)
  const displayedAppointments = appointments
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  const handleReviewClick = (apt: Appointment) => {
    setSelectedAppointmentForReview(apt);
    setReviewModalOpen(true);
  };

  const handlePaymentClick = (apt: Appointment) => {
    setSelectedAppointmentForPayment(apt);
    setPaymentModalOpen(true);
  };

  const handleWhatsAppClick = (phone: string | undefined, customerName: string, date: string, time: string, serviceName: string) => {
    if (!phone) {
      toast.error("Telefone não cadastrado para este cliente.");
      return;
    }
    
    const message = `Olá ${customerName}, tudo bem? 🌟\n\nPassando para lembrar do seu agendamento de *${serviceName}* marcado para *${date} às ${time}*.\n\nPodemos confirmar sua presença?`;
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    
    window.open(`https://wa.me/${fullPhone}?text=${encodedMessage}`, "_blank");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {displayedAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhum agendamento encontrado.</p>
            ) : (
              displayedAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://avatar.vercel.sh/${apt.customer_name}.png`} alt={apt.customer_name} />
                    <AvatarFallback>{apt.customer_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <button 
                      onClick={() => setSelectedCustomer({ name: apt.customer_name, phone: apt.customer_phone })}
                      className="text-sm font-medium leading-none hover:underline text-left"
                    >
                      {apt.customer_name}
                    </button>
                    <p className="text-sm text-muted-foreground">
                      {apt.service?.name} - {format(new Date(apt.start_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="ml-auto font-medium flex items-center gap-2">
                    <span className="mr-2 hidden sm:inline">R$ {apt.service?.price.toFixed(2)}</span>
                    
                    {/* Payment Badge */}
                    {apt.payment_status === 'paid' && (
                      <div className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-200 mr-1">
                        Pago
                      </div>
                    )}

                    {/* Review Button (Only for completed) */}
                    {apt.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-10 w-10 rounded-xl transition-all ${apt.review ? "text-amber-500 bg-amber-50" : "text-stitch-on-surface-variant/40 hover:text-amber-500 hover:bg-amber-50"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReviewClick(apt);
                        }}
                        title={apt.review ? "Ver avaliação" : "Avaliar atendimento"}
                        disabled={!!apt.review}
                      >
                        <span 
                          className="material-symbols-outlined text-xl"
                          style={{ fontVariationSettings: apt.review ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          star
                        </span>
                      </Button>
                    )}

                    {/* Payment Button (If not paid and not cancelled) */}
                    {apt.status !== 'cancelled' && apt.payment_status !== 'paid' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePaymentClick(apt);
                        }}
                        title="Registrar Pagamento"
                      >
                        <span className="material-symbols-outlined text-xl text-emerald-600">payments</span>
                      </Button>
                    )}

                    {/* WhatsApp Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppClick(
                          apt.customer_phone, 
                          apt.customer_name, 
                          format(new Date(apt.start_time), "dd/MM", { locale: ptBR }),
                          format(new Date(apt.start_time), "HH:mm", { locale: ptBR }),
                          apt.service?.name || "Atendimento"
                        );
                      }}
                      title="Enviar lembrete no WhatsApp"
                    >
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                    </Button>

                    {/* Complete Button */}
                    {(apt.status === "pending" || apt.status === "confirmed") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-stitch-on-surface-variant/40 hover:text-stitch-primary hover:bg-stitch-primary/5 transition-all"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await onUpdateStatus(apt.id, "completed");
                            toast.success("Agendamento concluído!");
                          } catch {
                            toast.error("Erro ao concluir agendamento.");
                          }
                        }}
                        title="Marcar como concluído"
                      >
                        <span className="material-symbols-outlined text-xl">check_circle</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCustomer && (
        <CustomerDetailsDialog
          open={!!selectedCustomer}
          onOpenChange={(open) => !open && setSelectedCustomer(null)}
          customerName={selectedCustomer.name}
          customerPhone={selectedCustomer.phone}
          appointments={appointments}
        />
      )}

      <ReviewDialog
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        appointment={selectedAppointmentForReview}
      />

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        appointment={selectedAppointmentForPayment}
        onPaymentComplete={() => {
           // In a real app we might refetch, but here we rely on React Query or parent state update
           setPaymentModalOpen(false);
        }}
      />
    </>
  );
}
