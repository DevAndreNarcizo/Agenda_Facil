import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Need to create tabs.tsx
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("30");

  useEffect(() => {
    if (profile) {
      fetchOrgDetails();
      fetchServices();
    }
  }, [profile]);

  const fetchOrgDetails = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();
    
    if (data) {
      setOrgName(data.name);
      setOrgSlug(data.slug);
    }
  };

  const fetchServices = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("name");
    setServices(data || []);
  };

  const handleUpdateOrg = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName, slug: orgSlug })
        .eq("id", profile?.organization_id);
      
      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Error updating org:", error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newServicePrice) return;

    try {
      const { error } = await supabase
        .from("services")
        .insert({
          organization_id: profile?.organization_id,
          name: newServiceName,
          price: parseFloat(newServicePrice),
          duration_minutes: parseInt(newServiceDuration),
        });

      if (error) throw error;
      
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceDuration("30");
      fetchServices();
      toast.success("Serviço adicionado com sucesso!");
    } catch (error) {
      console.error("Error adding service:", error);
      toast.error("Erro ao adicionar serviço.");
    }
  };

  const handleDeleteService = async (id: string) => {
    // Ideally replace confirm with a Dialog, but for now just toast on error/success
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      fetchServices();
      toast.success("Serviço excluído com sucesso!");
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Erro ao excluir serviço.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Configurações</h3>
        <p className="text-sm text-muted-foreground">
          Gerencie as configurações da sua empresa e serviços.
        </p>
      </div>
      
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Perfil da Empresa</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>
                Atualize o nome e identificador da sua empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nome da Empresa</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgSlug">Slug (URL)</Label>
                <Input
                  id="orgSlug"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                />
              </div>
              <Button onClick={handleUpdateOrg} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Serviços Oferecidos</CardTitle>
              <CardDescription>
                Gerencie os serviços que seus clientes podem agendar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddService} className="flex gap-4 items-end border-b pb-6">
                <div className="grid gap-2 flex-1">
                  <Label htmlFor="serviceName">Nome do Serviço</Label>
                  <Input
                    id="serviceName"
                    placeholder="Ex: Corte de Cabelo"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2 w-32">
                  <Label htmlFor="servicePrice">Preço (R$)</Label>
                  <Input
                    id="servicePrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2 w-32">
                  <Label htmlFor="serviceDuration">Duração (min)</Label>
                  <Input
                    id="serviceDuration"
                    type="number"
                    step="5"
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </form>

              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {service.duration_minutes} min • R$ {service.price}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum serviço cadastrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
