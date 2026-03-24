import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServices, type Service } from "@/hooks/use-services";
import { toast } from "sonner";

export function ServiceManager() {
  const { services, loading, createService, updateService, deleteService } = useServices();
  const [open, setOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("");

  const resetForm = () => {
    setName("");
    setPrice("");
    setDuration("");
    setCategory("");
    setEditingService(null);
    setIsFormOpen(false);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setPrice(service.price.toString());
    setDuration(service.duration_minutes.toString());
    setCategory(service.category || "");
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      setActionLoading(true);
      await deleteService(id);
      toast.success("Serviço excluído com sucesso!");
    } catch {
      toast.error("Erro ao excluir serviço");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const serviceData = {
        name,
        price: parseFloat(price),
        duration_minutes: parseInt(duration),
        category: category || undefined,
      };

      if (editingService) {
        await updateService(editingService.id, serviceData);
      } else {
        await createService(serviceData);
      }
      resetForm();
      toast.success("Serviço salvo com sucesso!");
    } catch {
      toast.error("Erro ao salvar serviço");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Gerenciar Serviços</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-10 pb-6 bg-stitch-surface-container-low/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">content_cut</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-stitch-on-surface">Gerenciar Serviços</DialogTitle>
              <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                Adicione, edite ou remova serviços oferecidos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isFormOpen ? (
          <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Nome do Serviço</Label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">content_cut</span>
                <Input
                  id="name"
                  className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Corte de Cabelo Premium"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Preço (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant font-bold text-sm">R$</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    className="pl-10 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Duração (min)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-on-surface-variant opacity-50">schedule</span>
                  <Input
                    id="duration"
                    type="number"
                    className="pl-12 h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Categoria (opcional)</Label>
              <Input
                id="category"
                className="h-14 rounded-xl border-none bg-[#1a1c1e] text-white font-bold px-4 placeholder:text-white/20"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Cabelo, Barba, Estética"
              />
            </div>

            <div className="flex gap-3 pt-6">
              <Button type="button" variant="ghost" className="flex-1 h-14 rounded-xl font-bold" onClick={resetForm} disabled={actionLoading}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 h-14 rounded-xl font-black text-lg shadow-lg shadow-stitch-primary/20" disabled={actionLoading}>
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  editingService ? "Atualizar Serviço" : "Salvar Serviço"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsFormOpen(true)} className="h-12 px-6 rounded-xl font-bold gap-2 shadow-md shadow-stitch-primary/10">
                <span className="material-symbols-outlined">add</span>
                Novo Serviço
              </Button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
                <p className="text-sm font-bold text-stitch-on-surface-variant opacity-60">Carregando catálogo...</p>
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-20 bg-stitch-surface-container-lowest rounded-[2rem] border-2 border-dashed border-stitch-outline-variant/20">
                <span className="material-symbols-outlined text-5xl text-stitch-on-surface-variant opacity-20 mb-4">content_cut</span>
                <p className="font-bold text-stitch-on-surface-variant">Nenhum serviço cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-5 rounded-2xl bg-white border border-stitch-outline-variant/10 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-stitch-primary/5 flex items-center justify-center text-stitch-primary group-hover:bg-stitch-primary group-hover:text-white transition-all">
                        <span className="material-symbols-outlined">auto_fix_high</span>
                      </div>
                      <div>
                        <p className="font-black text-stitch-on-surface leading-tight">{service.name}</p>
                        <p className="text-xs font-bold text-stitch-on-surface-variant opacity-60">
                          {service.duration_minutes} min • R$ {service.price.toFixed(2)}
                          {service.category && ` • ${service.category}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-stitch-primary/10 hover:text-stitch-primary transition-all"
                        onClick={() => handleEdit(service)}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-stitch-on-surface-variant/40 hover:text-stitch-error hover:bg-stitch-error/10 transition-all"
                        onClick={() => handleDelete(service.id)}
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
