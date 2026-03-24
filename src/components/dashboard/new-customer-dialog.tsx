import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreateCustomer: (data: { name: string; phone: string; email: string }) => void;
}

export function NewCustomerDialog({
  open,
  onOpenChange,
  initialName,
  onCreateCustomer,
}: NewCustomerDialogProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Remove formatação antes de enviar
    const cleanPhone = phone.replace(/\D/g, '');
    onCreateCustomer({ name, phone: cleanPhone, email });
    onOpenChange(false);
    // Reset form
    setName("");
    setPhone("");
    setEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">person_add</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-stitch-on-surface">Novo Cliente</DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Cadastre um novo cliente rapidamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Nome Completo *</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">person</span>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] font-bold text-white placeholder:text-white/20"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Telefone / WhatsApp *</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">call</span>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] font-bold text-white placeholder:text-white/20"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Email (Opcional)</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">mail</span>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] font-bold text-white placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <span className="material-symbols-outlined font-black">person_add</span>
              Cadastrar Cliente
            </Button>
            <Button 
                type="button" 
                variant="ghost" 
                className="h-12 rounded-xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
