import { useState } from "react";
import { usePromotions, type CreatePromotionData } from "@/hooks/use-promotions";
import { useServices } from "@/hooks/use-services";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Tag } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function PromotionsManager() {
  const { promotions, createPromotion, deletePromotion, togglePromotionStatus, isLoading } = usePromotions();
  const { services } = useServices();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreatePromotionData>({
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: 0,
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    service_id: "all", // "all" for global, or specific UUID
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createPromotion({
        ...formData,
        service_id: formData.service_id === "all" ? null : formData.service_id,
        end_date: formData.end_date || undefined,
      });
      setFormData({
        name: "",
        description: "",
        discount_type: "percentage",
        discount_value: 0,
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: "",
        service_id: "all",
      });
      toast.success("Promoção criada com sucesso!");
    } catch (error) {
      console.error("Error creating promotion:", error);
      toast.error("Erro ao criar promoção.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta promoção?")) {
      try {
        await deletePromotion(id);
        toast.success("Promoção excluída com sucesso!");
      } catch (error) {
        console.error("Error deleting promotion:", error);
        toast.error("Erro ao excluir promoção.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tag className="h-4 w-4" />
          Promoções
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Promoções</DialogTitle>
          <DialogDescription>
            Crie e gerencie pacotes e descontos para seus clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 md:grid-cols-2">
          {/* Form Side */}
          <div className="space-y-4 border-r pr-4">
            <h3 className="font-medium">Nova Promoção</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Promoção</Label>
                <Input
                  id="name"
                  placeholder="Ex: Verão 2024, Pacote Corte + Barba"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Input
                  id="description"
                  placeholder="Detalhes da promoção..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Desconto</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: 'percentage' | 'fixed') => setFormData({ ...formData, discount_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Desconto</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Aplica-se a</Label>
                <Select
                  value={formData.service_id || "all"}
                  onValueChange={(value: string) => setFormData({ ...formData, service_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Serviços</SelectItem>
                    {services?.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Início</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Fim (Opcional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar Promoção"}
              </Button>
            </form>
          </div>

          {/* List Side */}
          <div className="space-y-4">
            <h3 className="font-medium">Promoções Ativas</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : promotions?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma promoção cadastrada.</p>
              ) : (
                promotions?.map((promo) => (
                  <div
                    key={promo.id}
                    className={`flex flex-col gap-2 p-3 rounded-lg border ${
                      promo.active ? "bg-card" : "bg-muted/50 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{promo.name}</span>
                          <Badge variant={promo.active ? "default" : "secondary"}>
                            {promo.discount_type === 'percentage' 
                              ? `${promo.discount_value}% OFF` 
                              : `R$ ${promo.discount_value} OFF`}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {promo.service ? `Apenas: ${promo.service.name}` : "Todos os serviços"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Validade: {format(new Date(promo.start_date), "dd/MM/yy")} 
                          {promo.end_date ? ` até ${format(new Date(promo.end_date), "dd/MM/yy")}` : " (Indeterminado)"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                        onClick={() => handleDelete(promo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Switch
                        checked={promo.active}
                        onCheckedChange={(checked: boolean) => togglePromotionStatus({ id: promo.id, active: checked })}
                      />
                      <span className="text-xs text-muted-foreground">
                        {promo.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
