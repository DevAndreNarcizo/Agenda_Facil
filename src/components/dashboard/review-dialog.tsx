import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useReviews } from "@/hooks/use-reviews";
import type { Appointment } from "@/hooks/use-appointments";
import { toast } from "sonner";

interface ReviewDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewDialog({ appointment, open, onOpenChange }: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { addReview } = useReviews();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!appointment || rating === 0) return;

    try {
      setIsSubmitting(true);
      await addReview({
        appointment_id: appointment.id,
        rating,
        comment,
      });
      onOpenChange(false);
      setRating(0);
      setComment("");
      toast.success("Avaliação enviada com sucesso!");
    } catch {
      toast.error("Erro ao enviar avaliação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[750px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
            <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">rate_review</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-stitch-on-surface">Avaliar Atendimento</DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Sua opinião é muito importante para nós.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-8 pb-8 space-y-6 mt-4">
          <div className="flex flex-col items-center gap-4 py-4 bg-stitch-surface-container-lowest rounded-3xl border border-stitch-outline-variant/10 shadow-sm">
            <Label className="text-sm font-black text-stitch-on-surface-variant uppercase tracking-wider">Sua nota</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-all hover:scale-125 active:scale-90"
                >
                  <span 
                    className={`material-symbols-outlined text-4xl transition-colors ${
                      star <= rating ? "text-yellow-500 fill-1 font-variation-fill" : "text-stitch-outline-variant opacity-30"
                    }`}
                    style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    star
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-bold ml-1">Comentário (Opcional)</Label>
            <textarea
              id="comment"
              className="flex min-h-[120px] w-full rounded-2xl border-none bg-[#1a1c1e] text-white font-bold px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-primary/20 appearance-none placeholder:text-white/20"
              placeholder="Conte como foi sua experiência..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button 
              className="h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
              onClick={handleSubmit} 
              disabled={rating === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined font-black">send</span>
                  Enviar Avaliação
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="h-12 rounded-xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
