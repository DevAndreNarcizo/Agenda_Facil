import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, Edit } from "lucide-react";

export default function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });

  useEffect(() => {
    if (profile?.organization_id) {
      fetchCustomers();
    }
  }, [profile?.organization_id]);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", profile?.organization_id)
      .order("name");
    setCustomers(data || []);
    setLoading(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
          })
          .eq("id", editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({
            organization_id: profile?.organization_id,
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
          });
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchCustomers();
      resetForm();
    } catch (error) {
      console.error("Error saving customer:", error);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "" });
  };

  const openEditModal = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
    });
    setIsModalOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Clientes</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie sua base de clientes.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(open: boolean) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone || "-"}</TableCell>
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(customer)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
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
  );
}
