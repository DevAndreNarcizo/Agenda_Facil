import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
}

interface ServiceFormData {
  name: string;
  duration_minutes: number;
  price: number;
  description: string;
}

interface ServiceFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingService: Service | null;
  formData: ServiceFormData;
  onFormChange: (data: ServiceFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ServiceForm({
  isOpen,
  onOpenChange,
  editingService,
  formData,
  onFormChange,
  onSubmit,
}: ServiceFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-16 px-10 rounded-2xl font-black text-lg gap-3 shadow-lg shadow-stitch-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          <span className="material-symbols-outlined text-2xl">add_box</span>
          Novo Serviço
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">
                {editingService ? "edit" : "service_toolbox"}
              </span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black font-headline text-stitch-on-surface">
                {editingService ? "Editar Serviço" : "Novo Serviço"}
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Configure os detalhes do seu serviço.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-10 pb-10 space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold ml-1">Nome do Serviço</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">content_cut</span>
              <Input
                id="name"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                value={formData.name}
                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                required
                placeholder="Ex: Corte de Cabelo Premium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-bold ml-1">Preço (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant font-black text-sm">R$</span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold transition-all focus-visible:ring-stitch-primary"
                  value={formData.price}
                  onChange={(e) => onFormChange({ ...formData, price: Number(e.target.value) })}
                  required
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm font-bold ml-1">Duração (min)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40">schedule</span>
                <Input
                  id="duration"
                  type="number"
                  className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold transition-all focus-visible:ring-stitch-primary"
                  value={formData.duration_minutes}
                  onChange={(e) => onFormChange({ ...formData, duration_minutes: Number(e.target.value) })}
                  required
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-bold ml-1">Descrição (opcional)</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">notes</span>
              <Input
                id="description"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                value={formData.description}
                onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                placeholder="Ex: Inclui lavagem e finalização"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined font-black">check_circle</span>
              {editingService ? "Atualizar Serviço" : "Salvar Serviço"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
