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

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
}

interface CustomerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: { id: string; name: string; phone: string; email: string | null } | null;
  formData: CustomerFormData;
  onFormChange: (data: CustomerFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
}

export function CustomerModal({
  isOpen,
  onOpenChange,
  editingCustomer,
  formData,
  onFormChange,
  onSubmit,
  saving,
}: CustomerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full h-16 rounded-2xl font-black text-lg gap-3 shadow-lg shadow-stitch-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          <span className="material-symbols-outlined text-2xl">person_add</span>
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">
                {editingCustomer ? "person_edit" : "person_add"}
              </span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black font-headline text-stitch-on-surface">
                {editingCustomer ? "Editar Cadastro" : "Novo Cliente"}
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Mantenha o histórico do cliente atualizado.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-10 pb-10 space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold ml-1">Nome Completo</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">person</span>
              <Input
                id="name"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                value={formData.name}
                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                required
                placeholder="Ex: Ana Beatriz Oliveira"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-bold ml-1">WhatsApp / Telefone</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">call</span>
              <Input
                id="phone"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                value={formData.phone}
                onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                placeholder="(11) 98765-4321"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold ml-1">Email</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">mail</span>
              <Input
                id="email"
                type="email"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                value={formData.email}
                onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined font-black">save</span>
                  {editingCustomer ? "Atualizar Cadastro" : "Salvar Cliente"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
