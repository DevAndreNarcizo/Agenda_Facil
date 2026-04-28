import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEmployees } from "@/hooks/use-employees";
import { useAppointments } from "@/hooks/use-appointments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Schema for adding an employee
const addEmployeeSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type AddEmployeeForm = z.infer<typeof addEmployeeSchema>;

export default function EmployeesPage() {
  const { employees, loading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { appointments } = useAppointments();
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Edit state
  const [editingEmployee, setEditingEmployee] = useState<{ id: string; full_name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddEmployeeForm>({
    resolver: zodResolver(addEmployeeSchema),
  });

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular agendamentos de hoje por profissional
  const today = new Date().toISOString().split("T")[0];
  const todayAppointments = appointments.filter(a =>
    a.start_time.startsWith(today) && a.status !== "cancelled"
  );

  const getEmployeeTodayCount = (empId: string) => {
    return todayAppointments.filter(a => a.employee_id === empId).length;
  };

  const onSubmit = async (data: AddEmployeeForm) => {
    setCreating(true);
    try {
      await createEmployee(data);
      reset();
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
    switch (role) {
      case "owner": return "Proprietário";
      case "admin": return "Administrador";
      case "staff": return "Staff";
      default: return "Profissional";
    }
  };

  return (
    <div className="space-y-12 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Equipe Studio</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Gerenciar Profissionais</h1>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  <DialogTitle className="text-2xl font-black font-headline text-stitch-on-surface">Novo Profissional</DialogTitle>
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
                <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black text-lg gap-2 shadow-xl shadow-stitch-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={creating}>
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
            <Button onClick={() => setIsDialogOpen(true)} className="h-14 px-10 rounded-xl font-black text-lg shadow-xl shadow-stitch-primary/20 hover:scale-105 transition-all">
              Adicionar Primeiro Profissional
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredEmployees.map((employee) => {
            const todayCount = getEmployeeTodayCount(employee.id);
            return (
              <Card key={employee.id} className="group overflow-hidden border-0 bg-stitch-surface-container-lowest hover:shadow-2xl hover:shadow-stitch-primary/10 transition-all duration-300">
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <Avatar className="w-28 h-28 border-4 border-stitch-surface-container-low shadow-sm scale-110 group-hover:scale-125 transition-transform duration-500">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.full_name}`} />
                      <AvatarFallback className="bg-stitch-primary/10 text-stitch-primary font-bold text-2xl">
                        {employee.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-1 right-2 w-6 h-6 bg-green-500 border-4 border-stitch-surface-container-lowest rounded-full shadow-sm" />
                  </div>

                  <h3 className="font-headline text-xl font-bold text-stitch-on-surface mb-1 group-hover:text-stitch-primary transition-colors">
                    {employee.full_name}
                  </h3>
                  <p className="text-stitch-primary font-semibold text-sm mb-2">{getRoleLabel(employee.role)}</p>

                  {todayCount > 0 && (
                    <p className="text-xs font-bold text-stitch-on-surface-variant opacity-60 mb-4">
                      {todayCount} agendamento{todayCount > 1 ? "s" : ""} hoje
                    </p>
                  )}

                  <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-stitch-secondary-container text-stitch-on-secondary-container text-xs font-black uppercase tracking-widest shadow-sm">
                    Ativo
                  </div>

                  <div className="w-full flex gap-3 border-t border-stitch-surface-container mt-8 pt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-xl h-11 font-bold border-2"
                      onClick={() => openEditDialog(employee)}
                    >
                      <span className="material-symbols-outlined text-lg mr-2">edit</span>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-xl h-11 font-bold text-stitch-error hover:bg-stitch-error/10 hover:text-stitch-error"
                      onClick={() => handleDeleteEmployee(employee.id, employee.full_name)}
                    >
                      <span className="material-symbols-outlined text-lg mr-2">delete</span>
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add New Card Placeholder */}
          <button
            onClick={() => setIsDialogOpen(true)}
            className="group bg-stitch-surface-container-low border-2 border-dashed border-stitch-outline-variant/30 rounded-stitch-lg p-8 flex flex-col items-center justify-center text-center gap-4 cursor-pointer hover:bg-stitch-primary/5 hover:border-stitch-primary/50 transition-all duration-300"
          >
            <div className="w-20 h-20 rounded-full bg-stitch-surface-container flex items-center justify-center text-stitch-on-surface-variant group-hover:bg-stitch-primary group-hover:text-white transition-all duration-300 transform group-hover:rotate-90">
              <span className="material-symbols-outlined text-4xl">add</span>
            </div>
            <div>
              <p className="font-headline font-black text-stitch-on-surface text-lg">Adicionar Novo</p>
              <p className="text-sm font-medium text-stitch-on-surface-variant opacity-60">Amplie sua equipe</p>
            </div>
          </button>
        </div>
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
            <p className="text-3xl font-black text-stitch-on-surface leading-none">{employees.length} Membro{employees.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="bg-stitch-secondary/5 p-8 rounded-stitch-md flex items-center gap-6 border border-stitch-secondary/10 shadow-sm">
          <div className="bg-stitch-secondary-container w-16 h-16 rounded-2xl flex items-center justify-center text-stitch-on-secondary-container shadow-inner">
            <span className="material-symbols-outlined text-3xl">event_available</span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-stitch-secondary opacity-60 mb-1">Atendimentos Hoje</p>
            <p className="text-3xl font-black text-stitch-on-surface leading-none">{todayAppointments.length} agendamento{todayAppointments.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="bg-stitch-tertiary-container/10 p-8 rounded-stitch-md flex items-center gap-6 border border-stitch-tertiary-container/10 shadow-sm">
          <div className="bg-stitch-tertiary-container w-16 h-16 rounded-2xl flex items-center justify-center text-stitch-on-tertiary-container shadow-inner">
            <span className="material-symbols-outlined text-3xl">verified</span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-stitch-tertiary opacity-60 mb-1">Roles</p>
            <p className="text-3xl font-black text-stitch-on-surface leading-none">
              {employees.filter(e => e.role === "admin" || e.role === "owner").length} Admin{employees.filter(e => e.role === "admin" || e.role === "owner").length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
