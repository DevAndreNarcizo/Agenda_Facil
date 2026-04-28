import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
}

export default function ServicesPage() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    duration_minutes: 30, 
    price: 0,
    description: "" 
  });

  useEffect(() => {
    if (profile?.organization_id) {
      fetchServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id]);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", profile?.organization_id)
      .order("name");
    
    if (error) {
      toast.error("Erro ao carregar serviços");
    } else {
      setServices(data || []);
    }
    setLoading(false);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    if (!profile?.organization_id) {
      toast.error("Organização não encontrada. Tente fazer login novamente.");
      return;
    }

    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            name: formData.name,
            duration_minutes: Number(formData.duration_minutes),
            price: Number(formData.price),
            description: formData.description,
          })
          .eq("id", editingService.id);
        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("services")
          .insert({
            organization_id: profile?.organization_id,
            name: formData.name,
            duration_minutes: Number(formData.duration_minutes),
            price: Number(formData.price),
            description: formData.description,
          });
        if (error) throw error;
        toast.success("Novo serviço cadastrado!");
      }

      setIsModalOpen(false);
      fetchServices();
      resetForm();
    } catch {
      toast.error("Erro ao salvar serviço. Verifique os dados.");
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Serviço removido.");
      fetchServices();
    } catch {
      toast.error("Erro ao remover serviço.");
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({ 
      name: "", 
      duration_minutes: 30, 
      price: 0,
      description: "" 
    });
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: service.price,
      description: service.description || "",
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-12 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Catálogo</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Gestão de Serviços</h1>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(open: boolean) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}>
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
                  <span className="material-symbols-outlined text-3xl">{editingService ? "edit" : "service_toolbox"}</span>
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

            <form onSubmit={handleSaveService} className="px-10 pb-10 space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold ml-1">Nome do Serviço</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">content_cut</span>
                  <Input
                    id="name"
                    className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
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
                      onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
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
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Inclui lavagem e finalização"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <span className="material-symbols-outlined font-black">check_circle</span>
                  {editingService ? "Atualizar Serviço" : "Salvar Serviço"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Stats Bar */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
        <div className="lg:col-span-3 space-y-3">
          <Label className="text-sm font-bold text-stitch-on-surface-variant ml-1">Encontrar Serviço</Label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity text-2xl">search</span>
            <Input 
              className="h-16 pl-14 text-lg bg-[#1a1c1e] text-white border-none rounded-2xl shadow-none font-bold placeholder:text-white/20"
              placeholder="Nome ou descrição do serviço..."
            />
          </div>
        </div>
        <Card className="p-6 rounded-2xl bg-stitch-surface-container-low/30 border-none shadow-none hover:shadow-none flex items-center justify-between h-16">
           <span className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant">Ativos:</span>
           <span className="text-2xl font-black font-headline text-stitch-primary">{services.length}</span>
        </Card>
      </section>

      {/* Services Grid/Table */}
      <div className="bg-stitch-surface-container-low/30 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-none border-none">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-stitch-surface-container-low/50 hover:bg-transparent border-0">
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Serviço</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Preço</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Duração</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
                      <p className="font-bold text-stitch-on-surface-variant">Carregando catálogo...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : services.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-center py-32 bg-transparent border-0">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-24 h-24 rounded-full bg-stitch-surface-container flex items-center justify-center text-stitch-on-surface-variant/40">
                        <span className="material-symbols-outlined text-5xl">inventory_2</span>
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="font-black text-2xl text-stitch-on-surface">Nenhum serviço disponível</p>
                        <p className="text-stitch-on-surface-variant font-medium opacity-60 max-w-xs mx-auto">Comece cadastrando seus serviços para abrir sua agenda ao seu público.</p>
                      </div>
                      <Button onClick={() => setIsModalOpen(true)} className="rounded-xl h-12 px-8 font-black shadow-lg shadow-stitch-primary/20">
                        Cadastrar Primeiro Serviço
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                services.map((service) => (
                  <TableRow key={service.id} className="bg-stitch-surface-container-lowest hover:bg-stitch-primary/5 transition-colors border-b border-stitch-outline-variant/10">
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary shadow-sm group-hover:bg-stitch-primary group-hover:text-white transition-all">
                          <span className="material-symbols-outlined">auto_fix_high</span>
                        </div>
                        <div>
                          <p className="font-black text-stitch-on-surface text-lg leading-tight">{service.name}</p>
                          <p className="text-xs font-medium text-stitch-on-surface-variant opacity-60 leading-tight">
                            {service.description || "Sem descrição informada"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-6">
                      <p className="text-xl font-black text-stitch-on-surface">R$ {service.price.toFixed(2)}</p>
                    </TableCell>
                    <TableCell className="px-8 py-6">
                      <Badge variant="secondary" className="px-3 py-1 font-black text-sm rounded-xl gap-2">
                        <span className="material-symbols-outlined text-base">schedule</span>
                        {service.duration_minutes} min
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-12 w-12 rounded-2xl hover:bg-stitch-primary/10 hover:text-stitch-primary"
                          onClick={() => openEditModal(service)}
                        >
                          <span className="material-symbols-outlined text-2xl">edit</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-12 w-12 rounded-2xl hover:bg-stitch-error/10 hover:text-stitch-error"
                          onClick={() => handleDeleteService(service.id)}
                        >
                          <span className="material-symbols-outlined text-2xl">delete_sweep</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Suggestion Bento Card */}
      <div className="bg-stitch-primary text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 max-w-lg">
          <h3 className="text-3xl font-black font-headline mb-4">Aumente seus lucros com combos</h3>
          <p className="text-stitch-on-primary-fixed-variant font-medium text-lg mb-8 opacity-90">
            Combine serviços populares como "Corte + Barba" e ofereça descontos exclusivos para seus clientes fiéis.
          </p>
          <Button className="bg-white text-stitch-primary h-14 px-8 rounded-xl font-black text-lg hover:bg-stitch-surface-container-low transition-all">
            Criar meu primeiro Combo
          </Button>
        </div>
        <div className="absolute right-[-10%] top-[-20%] w-96 h-96 bg-white/10 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-700" />
        <span className="material-symbols-outlined absolute right-12 bottom-12 text-[120px] opacity-10 group-hover:scale-125 group-hover:-rotate-12 transition-all duration-500">sell</span>
      </div>
    </div>
  );
}
