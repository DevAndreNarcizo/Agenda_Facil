import { UseFormReturn } from "react-hook-form";
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

interface AddEmployeeFormValues {
  fullName: string;
  email: string;
  password: string;
}

interface EmployeeFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<AddEmployeeFormValues>;
  onSubmit: (data: AddEmployeeFormValues) => void;
  creating: boolean;
}

export function EmployeeForm({ isOpen, onOpenChange, form, onSubmit, creating }: EmployeeFormProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-16 px-10 rounded-2xl font-black text-lg gap-3 shadow-lg shadow-stitch-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          <span className="material-symbols-outlined text-2xl">person_add</span>
          Novo Profissional
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans bg-[#0f1113]">
        <DialogHeader className="p-10 pb-6 bg-[#1a1c1e]/50 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">person_add</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black font-headline text-stitch-on-surface">
                Novo Profissional
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Cadastre um novo membro para sua equipe.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-10 pb-10 space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-bold ml-1 text-white/70">Nome Completo</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">person</span>
              <Input
                id="fullName"
                placeholder="Ex: Maria Oliveira"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                {...register("fullName")}
              />
            </div>
            {errors.fullName && (
              <p className="text-xs font-medium text-stitch-error ml-1">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold ml-1 text-white/70">Email Profissional</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">mail</span>
              <Input
                id="email"
                type="email"
                placeholder="maria@empresa.com"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs font-medium text-stitch-error ml-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-bold ml-1 text-white/70">Senha de Acesso</Label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity">lock</span>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xs font-medium text-stitch-error ml-1">{errors.password.message}</p>
            )}
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={creating}
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adicionando...
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined font-black">check_circle</span>
                  Criar Conta Profissional
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
