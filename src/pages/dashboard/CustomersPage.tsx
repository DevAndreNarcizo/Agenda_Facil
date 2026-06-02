import { useState } from "react";
import { useCustomers } from "@/hooks/use-customers";
import { toast } from "sonner";
import { CustomerModal } from "./components/CustomerModal";
import { CustomerFilters } from "./components/CustomerFilters";
import { CustomersTable } from "./components/CustomersTable";

const ITEMS_PER_PAGE = 10;

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
}

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; name: string; phone: string; email: string | null } | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
    } catch {
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
    } catch {
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

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
        <div className="lg:col-span-3">
          <CustomerFilters searchTerm={searchTerm} onSearch={handleSearch} />
        </div>
        <div className="lg:col-span-1">
          <CustomerModal
            isOpen={isModalOpen}
            onOpenChange={(open) => {
              setIsModalOpen(open);
              if (!open) resetForm();
            }}
            editingCustomer={editingCustomer}
            formData={formData}
            onFormChange={setFormData}
            onSubmit={handleSaveCustomer}
            saving={saving}
          />
        </div>
      </section>

      <CustomersTable
        customers={paginatedCustomers}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalFiltered={filteredCustomers.length}
        onPageChange={setCurrentPage}
        onEdit={openEditModal}
        onDelete={handleDeleteCustomer}
        formatDate={formatDate}
      />

      {/* CRM Stats Summary */}
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
            <span className="text-4xl font-black text-stitch-on-surface">
              {customers.filter((c) => (c.total_appointments || 0) > 0).length}
            </span>
            <span className="text-xs font-medium text-stitch-on-surface-variant opacity-40">com agendamentos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
