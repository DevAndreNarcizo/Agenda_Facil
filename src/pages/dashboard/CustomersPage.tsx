import { useState } from "react";
import { useCustomers } from "@/hooks/use-customers";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

export default function CustomersPage() {
  const {
    customers,
    loading,
    newThisMonth,
    returnRate,
    totalCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  } = useCustomers();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; name: string; phone: string; email: string | null } | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginação real
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setSaving(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
        });
        toast.success("Cliente atualizado com sucesso!");
      } else {
        await createCustomer({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
        });
        toast.success("Cliente cadastrado com sucesso!");
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Erro ao salvar cliente. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    try {
      await deleteCustomer(id);
      toast.success("Cliente excluído com sucesso!");
    } catch (error) {
      toast.error("Erro ao excluir cliente. Verifique se não há agendamentos vinculados.");
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "" });
  };

  const openEditModal = (customer: { id: string; name: string; phone: string; email: string | null }) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
    });
    setIsModalOpen(true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Sem visitas";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-12 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Relacionamento</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">CRM Clientes</h1>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
        <div className="lg:col-span-3 space-y-3">
          <Label className="text-sm font-bold text-stitch-on-surface-variant ml-1">Pesquisar na base de clientes</Label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity text-2xl">search</span>
            <Input
              className="h-16 pl-14 text-lg bg-[#1a1c1e] text-white border-none rounded-2xl shadow-xl font-bold placeholder:text-white/20"
              placeholder="Nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="lg:col-span-1">
          <Dialog open={isModalOpen} onOpenChange={(open: boolean) => {
            setIsModalOpen(open);
            if (!open) resetForm();
          }}>
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
                    <span className="material-symbols-outlined text-3xl">{editingCustomer ? "person_edit" : "person_add"}</span>
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

              <form onSubmit={handleSaveCustomer} className="px-10 pb-10 space-y-6 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold ml-1">Nome Completo</Label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">person</span>
                    <Input
                      id="name"
                      className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="cliente@email.com"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button type="submit" disabled={saving} className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
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
        </div>
      </section>

      {/* CRM Data Table Section */}
      <div className="bg-stitch-surface-container-low/30 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-stitch-surface-container-low/50 hover:bg-transparent border-0">
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Nome</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">WhatsApp</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Última Visita</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest text-center">Visitas</TableHead>
                <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
                      <p className="font-bold text-stitch-on-surface-variant">Carregando base de dados...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 bg-stitch-surface-container-lowest">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <span className="material-symbols-outlined text-6xl">person_search</span>
                      <p className="font-bold text-lg">Nenhum cliente encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="bg-stitch-surface-container-lowest hover:bg-stitch-primary/5 transition-colors border-b border-stitch-outline-variant/10">
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12 rounded-2xl shadow-sm">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${customer.name}`} />
                          <AvatarFallback className="bg-stitch-primary/10 text-stitch-primary font-black uppercase rounded-2xl">
                            {customer.name.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-black text-stitch-on-surface text-lg leading-tight">{customer.name}</p>
                          <p className="text-xs font-medium text-stitch-on-surface-variant opacity-60 leading-tight">{customer.email || "Sem email cadastrado"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center gap-2 text-stitch-on-surface-variant font-bold">
                        <span className="material-symbols-outlined text-green-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                        {customer.phone || "---"}
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-6">
                      <span className="text-stitch-on-surface font-black">
                        {formatDate(customer.last_appointment)}
                      </span>
                    </TableCell>
                    <TableCell className="px-8 py-6 text-center">
                      <Badge variant="secondary" className="px-3 py-1 font-black text-sm rounded-xl">
                        {customer.total_appointments || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-xl hover:bg-stitch-primary/10 hover:text-stitch-primary"
                          onClick={() => openEditModal(customer)}
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-xl hover:bg-stitch-error/10 hover:text-stitch-error"
                          onClick={() => handleDeleteCustomer(customer.id)}
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="px-8 py-6 bg-stitch-surface-container-low/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
            Mostrando {paginatedCustomers.length} de {filteredCustomers.length} clientes
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-stitch-outline-variant/20 bg-white shadow-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                // Show first, last, current and neighbors
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .map((page, idx, arr) => (
                <span key={page} className="contents">
                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                    <span className="flex items-center text-stitch-on-surface-variant opacity-40 px-1">...</span>
                  )}
                  <Button
                    variant={page === currentPage ? "default" : "outline"}
                    size="icon"
                    className={`h-10 w-10 rounded-xl font-black ${
                      page === currentPage
                        ? "bg-stitch-primary text-white shadow-md shadow-stitch-primary/20"
                        : "border-0 bg-transparent hover:bg-white text-stitch-on-surface-variant"
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                </span>
              ))}
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-stitch-outline-variant/20 bg-white shadow-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </Button>
          </div>
        </div>
      </div>

      {/* CRM Stats Summary - agora com dados reais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-stitch-surface-container-lowest p-8 rounded-[2rem] border-l-8 border-stitch-primary shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest mb-3 opacity-60">Novos este mês</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-stitch-on-surface">{newThisMonth}</span>
            <span className="text-xs font-bold text-stitch-primary">{totalCustomers} total</span>
          </div>
        </div>

        <div className="bg-stitch-surface-container-lowest p-8 rounded-[2rem] border-l-8 border-stitch-secondary-container shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest mb-3 opacity-60">Taxa de Retorno</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-stitch-on-surface">{returnRate}%</span>
            <span className="text-xs font-bold text-stitch-primary">Meta: 70%</span>
          </div>
        </div>

        <div className="bg-stitch-surface-container-lowest p-8 rounded-[2rem] border-l-8 border-stitch-tertiary-container shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest mb-3 opacity-60">Clientes Ativos</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-stitch-on-surface">{customers.filter(c => (c.total_appointments || 0) > 0).length}</span>
            <span className="text-xs font-medium text-stitch-on-surface-variant opacity-40">com agendamentos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
