import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEmployees } from "@/hooks/use-employees";
import { useAppointments } from "@/hooks/use-appointments";
import { isSameDayInSaoPaulo } from "@/hooks/use-dashboard-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmployeeForm } from "./components/EmployeeForm";
import { EmployeesTable } from "./components/EmployeesTable";

const addEmployeeSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type AddEmployeeForm = z.infer<typeof addEmployeeSchema>;

/**
 * Gerencia a equipe e exibe a carga diária no fuso America/Sao_Paulo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function EmployeesPage() {
  const { employees, loading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { appointments } = useAppointments();
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<{ id: string; full_name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const form = useForm<AddEmployeeForm>({
    resolver: zodResolver(addEmployeeSchema),
  });

  const filteredEmployees = employees.filter((e) =>
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayAppointments = appointments.filter(
    (appointment) => appointment.status !== "cancelled"
      && isSameDayInSaoPaulo(new Date(appointment.start_time)),
  );

  const getEmployeeTodayCount = (empId: string) =>
    todayAppointments.filter((a) => a.employee_id === empId).length;

  const onSubmit = async (data: AddEmployeeForm) => {
    setCreating(true);
    try {
      await createEmployee(data);
      form.reset();
      setIsDialogOpen(false);
      toast.success("Profissional adicionado com sucesso!");
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Erro ao adicionar funcionário");
    } finally {
      setCreating(false);
    }
  };

  const handleEditEmployee = async () => {
    if (!editingEmployee || !editName.trim()) return;
    try {
      await updateEmployee(editingEmployee.id, { full_name: editName });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      toast.success("Profissional atualizado com sucesso!");
    } catch {
      toast.error("Erro ao atualizar profissional.");
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover ${name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteEmployee(id);
      toast.success("Profissional removido com sucesso!");
    } catch {
      toast.error("Erro ao remover profissional. Verifique se não há agendamentos vinculados.");
    }
  };

  const openEditDialog = (employee: { id: string; full_name: string }) => {
    setEditingEmployee(employee);
    setEditName(employee.full_name);
    setIsEditDialogOpen(true);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: "Proprietário",
      admin: "Administrador",
      staff: "Staff",
    };
    return labels[role] ?? "Profissional";
  };

  return (
    <div className="space-y-12 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Equipe Studio</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Gerenciar Profissionais</h1>
        </div>
        <EmployeeForm
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          form={form}
          onSubmit={onSubmit}
          creating={creating}
        />
      </div>

      {/* Search & Stats Bar */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
        <div className="lg:col-span-3 space-y-3">
          <Label className="text-sm font-bold text-stitch-on-surface-variant ml-1">Filtrar Equipe</Label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity text-2xl">search</span>
            <Input
              className="h-16 pl-14 text-lg bg-[#1a1c1e] text-white border-none rounded-2xl shadow-xl font-bold placeholder:text-white/20"
              placeholder="Nome, cargo ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Card className="p-6 rounded-2xl bg-stitch-surface-container-low/30 border border-white/5 flex items-center justify-between h-16">
          <span className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant">Total:</span>
          <span className="text-2xl font-black font-headline text-stitch-primary">{employees.length}</span>
        </Card>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-stitch-md bg-stitch-surface-container animate-pulse" />
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-stitch-surface-container-low/30 backdrop-blur-xl border border-white/5 rounded-[3rem] p-24 flex flex-col items-center justify-center text-center gap-8 shadow-2xl">
          <div className="w-32 h-32 rounded-full bg-stitch-surface-container flex items-center justify-center text-stitch-on-surface-variant/30 relative">
            <span className="material-symbols-outlined text-6xl">badge</span>
            <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-stitch-primary rounded-full flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined">add</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-headline text-3xl font-black text-stitch-on-surface">
              {searchTerm ? "Nenhum resultado" : "Equipe Vazia"}
            </h3>
            <p className="text-stitch-on-surface-variant font-medium text-lg max-w-md mx-auto opacity-70">
              {searchTerm
                ? "Tente buscar com outro termo."
                : "Sua equipe é o coração do seu negócio. Adicione seu primeiro colaborador para começar a delegar atendimentos."}
            </p>
          </div>
          {!searchTerm && (
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="h-14 px-10 rounded-xl font-black text-lg shadow-xl shadow-stitch-primary/20 hover:scale-105 transition-all"
            >
              Adicionar Primeiro Profissional
            </Button>
          )}
        </div>
      ) : (
        <EmployeesTable
          employees={filteredEmployees}
          getTodayCount={getEmployeeTodayCount}
          getRoleLabel={getRoleLabel}
          onEdit={openEditDialog}
          onDelete={handleDeleteEmployee}
          onAdd={() => setIsDialogOpen(true)}
        />
      )}

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-sans bg-[#0f1113]">
          <DialogHeader className="p-10 pb-6 bg-[#1a1c1e]/50 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
                <span className="material-symbols-outlined text-3xl">person_edit</span>
              </div>
              <div>
                <DialogTitle className="text-2xl font-black font-headline text-stitch-on-surface">Editar Profissional</DialogTitle>
                <DialogDescription className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
                  Atualize os dados do membro da equipe.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-10 pb-10 space-y-6 mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold ml-1 text-white/70">Nome Completo</Label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity">person</span>
                <Input
                  className="pl-12 h-14 rounded-xl border-none !bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 transition-all focus-visible:ring-stitch-primary"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do profissional"
                />
              </div>
            </div>
            <Button
              onClick={handleEditEmployee}
              className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined font-black">save</span>
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Stats Summary */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-stitch-surface-container">
        <div className="bg-stitch-primary/5 p-8 rounded-stitch-md flex items-center gap-6 border border-stitch-primary/10 shadow-sm">
          <div className="bg-stitch-primary-container w-16 h-16 rounded-2xl flex items-center justify-center text-stitch-on-primary-container shadow-inner">
            <span className="material-symbols-outlined text-3xl">group_work</span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-stitch-primary opacity-60 mb-1">Total Equipe</p>
            <p className="text-3xl font-black text-stitch-on-surface leading-none">
              {employees.length} Membro{employees.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="bg-stitch-secondary/5 p-8 rounded-stitch-md flex items-center gap-6 border border-stitch-secondary/10 shadow-sm">
          <div className="bg-stitch-secondary-container w-16 h-16 rounded-2xl flex items-center justify-center text-stitch-on-secondary-container shadow-inner">
            <span className="material-symbols-outlined text-3xl">event_available</span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-stitch-secondary opacity-60 mb-1">Atendimentos Hoje</p>
            <p className="text-3xl font-black text-stitch-on-surface leading-none">
              {todayAppointments.length} agendamento{todayAppointments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="bg-stitch-tertiary-container/10 p-8 rounded-stitch-md flex items-center gap-6 border border-stitch-tertiary-container/10 shadow-sm">
          <div className="bg-stitch-tertiary-container w-16 h-16 rounded-2xl flex items-center justify-center text-stitch-on-tertiary-container shadow-inner">
            <span className="material-symbols-outlined text-3xl">verified</span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-stitch-tertiary opacity-60 mb-1">Roles</p>
            <p className="text-3xl font-black text-stitch-on-surface leading-none">
              {employees.filter((e) => e.role === "admin" || e.role === "owner").length} Admin
              {employees.filter((e) => e.role === "admin" || e.role === "owner").length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
