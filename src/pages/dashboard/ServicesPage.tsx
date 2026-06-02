import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ServiceForm } from "./components/ServiceForm";
import { ServicesTable } from "./components/ServicesTable";

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

const DEFAULT_FORM: ServiceFormData = { name: "", duration_minutes: 30, price: 0, description: "" };

export default function ServicesPage() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(DEFAULT_FORM);

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
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      toast.success("Serviço removido.");
      fetchServices();
    } catch {
      toast.error("Erro ao remover serviço.");
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData(DEFAULT_FORM);
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
        <ServiceForm
          isOpen={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) resetForm();
          }}
          editingService={editingService}
          formData={formData}
          onFormChange={setFormData}
          onSubmit={handleSaveService}
        />
      </div>

      {/* Search & Stats Bar */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
        <div className="lg:col-span-3 space-y-3">
          <Label className="text-sm font-bold text-stitch-on-surface-variant ml-1">Encontrar Serviço</Label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity text-2xl">search</span>
            <Input
              className="h-16 pl-14 text-lg bg-[#1a1c1e] text-white border-none rounded-2xl shadow-xl font-bold placeholder:text-white/20"
              placeholder="Nome ou descrição do serviço..."
            />
          </div>
        </div>
        <Card className="p-6 rounded-2xl bg-stitch-surface-container-low/30 border border-white/5 flex items-center justify-between h-16">
          <span className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant">Ativos:</span>
          <span className="text-2xl font-black font-headline text-stitch-primary">{services.length}</span>
        </Card>
      </section>

      <ServicesTable
        services={services}
        loading={loading}
        onEdit={openEditModal}
        onDelete={handleDeleteService}
        onAddFirst={() => setIsModalOpen(true)}
      />

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
