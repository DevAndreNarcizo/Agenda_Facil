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
    } catch (err: unknown) {
      const error = err as Error;
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
      <DialogContent className="sm:max-w-[700px] rounded-[3xl] border-none shadow-2xl p-0 overflow-hidden bg-stitch-surface">
        <DialogHeader className="p-8 pb-4 bg-stitch-surface-container-low/30">
          <DialogTitle className="text-2xl font-black text-stitch-on-surface">Registrar Pagamento</DialogTitle>
          <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
            {appointment?.customer_name} • {appointment?.service?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 py-6 space-y-6">
          <div className="flex flex-col items-center justify-center py-8 rounded-[2rem] bg-stitch-primary/5 border-2 border-stitch-primary/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-stitch-primary mb-1 opacity-60">Total a pagar</span>
            <span className="text-4xl font-black text-stitch-primary">
              R$ {appointment?.service?.price?.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              className={`flex flex-col h-28 gap-2 rounded-2xl border-2 transition-all group ${method === 'cash' ? "bg-stitch-primary/10 border-stitch-primary text-stitch-primary" : "bg-stitch-surface-container-low/30 border-transparent text-stitch-on-surface-variant hover:border-stitch-outline-variant/20 hover:bg-stitch-surface-container-low/50"}`}
              onClick={() => setMethod('cash')}
            >
              <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">payments</span>
              <span className="font-bold text-[10px] uppercase tracking-wider">Dinheiro</span>
            </Button>
            <Button
              variant="ghost"
              className={`flex flex-col h-28 gap-2 rounded-2xl border-2 transition-all group ${method === 'pix' ? "bg-stitch-primary/10 border-stitch-primary text-stitch-primary" : "bg-stitch-surface-container-low/30 border-transparent text-stitch-on-surface-variant hover:border-stitch-outline-variant/20 hover:bg-stitch-surface-container-low/50"}`}
              onClick={() => setMethod('pix')}
            >
              <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">qr_code_2</span>
              <span className="font-bold text-[10px] uppercase tracking-wider">Pix</span>
            </Button>
            <Button
              variant="ghost"
              className={`flex flex-col h-28 gap-2 rounded-2xl border-2 transition-all group ${method === 'credit_card' ? "bg-stitch-primary/10 border-stitch-primary text-stitch-primary" : "bg-stitch-surface-container-low/30 border-transparent text-stitch-on-surface-variant hover:border-stitch-outline-variant/20 hover:bg-stitch-surface-container-low/50"}`}
              onClick={() => setMethod('credit_card')}
            >
              <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">credit_card</span>
              <span className="font-bold text-[10px] uppercase tracking-wider">Crédito</span>
            </Button>
            <Button
              variant="ghost"
              className={`flex flex-col h-28 gap-2 rounded-2xl border-2 transition-all group ${method === 'debit_card' ? "bg-stitch-primary/10 border-stitch-primary text-stitch-primary" : "bg-stitch-surface-container-low/30 border-transparent text-stitch-on-surface-variant hover:border-stitch-outline-variant/20 hover:bg-stitch-surface-container-low/50"}`}
              onClick={() => setMethod('debit_card')}
            >
              <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">account_balance_wallet</span>
              <span className="font-bold text-[10px] uppercase tracking-wider">Débito</span>
            </Button>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-stitch-outline-variant/10" />
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="bg-stitch-surface px-4 text-stitch-on-surface-variant/40">
                Ou cobrança remota
              </span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-14 rounded-2xl font-bold border-2 border-stitch-outline-variant/20 hover:bg-stitch-primary/5 hover:text-stitch-primary hover:border-stitch-primary/20 transition-all gap-3 group"
            onClick={handleSimulateOnline} 
            disabled={loading}
          >
            <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">link</span>
            Enviar link de pagamento
          </Button>
        </div>

        <DialogFooter className="p-8 pt-2">
          <Button 
            className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] bg-stitch-primary text-white"
            onClick={handlePayment} 
            disabled={!method || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Confirmar Pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
