import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Appointment } from "@/hooks/use-appointments";
import { supabase } from "@/lib/supabase";
import { CreditCard, DollarSign, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";

interface PaymentModalProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: () => void;
}

export function PaymentModal({ appointment, open, onOpenChange, onPaymentComplete }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'credit_card' | 'debit_card' | 'pix' | 'cash' | 'online' | ''>('');
  const [amount] = useState(appointment?.service?.price || 0);

  const handlePayment = async () => {
    if (!appointment || !method) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          payment_status: 'paid',
          payment_method: method,
          amount_paid: amount,
          status: 'completed' // Auto-complete appointment on payment? Optional. Let's keep it separate or ask user. For now, just mark paid.
        })
        .eq("id", appointment.id);

      if (error) throw error;

      onPaymentComplete();
      onOpenChange(false);
      toast.success("Pagamento registrado com sucesso!");
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast.error(`Erro ao processar pagamento: ${error.message || "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateOnline = () => {
    setLoading(true);
    setTimeout(() => {
      toast.success(`Link de pagamento gerado para ${appointment?.customer_name}: https://stripe.com/pay/simulated_link_123`);
      setLoading(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            {appointment?.customer_name} - {appointment?.service?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
            <span className="text-3xl font-bold text-primary">
              R$ {appointment?.service?.price?.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={method === 'cash' ? "default" : "outline"}
              className="flex flex-col h-20 gap-2"
              onClick={() => setMethod('cash')}
            >
              <DollarSign className="h-6 w-6" />
              Dinheiro
            </Button>
            <Button
              variant={method === 'pix' ? "default" : "outline"}
              className="flex flex-col h-20 gap-2"
              onClick={() => setMethod('pix')}
            >
              <QrCode className="h-6 w-6" />
              Pix
            </Button>
            <Button
              variant={method === 'credit_card' ? "default" : "outline"}
              className="flex flex-col h-20 gap-2"
              onClick={() => setMethod('credit_card')}
            >
              <CreditCard className="h-6 w-6" />
              Crédito
            </Button>
            <Button
              variant={method === 'debit_card' ? "default" : "outline"}
              className="flex flex-col h-20 gap-2"
              onClick={() => setMethod('debit_card')}
            >
              <Wallet className="h-6 w-6" />
              Débito
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou pagamento online
              </span>
            </div>
          </div>

          <Button variant="secondary" onClick={handleSimulateOnline} disabled={loading}>
            Gerar Link de Pagamento (Simulação)
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={handlePayment} disabled={!method || loading}>
            {loading ? "Processando..." : "Confirmar Pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
