import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { describeError } from "@/hooks/use-organization";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees, type Employee } from "@/hooks/use-employees";
import { useAppointments } from "@/hooks/use-appointments";
import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { ListPrimaryCell, ListTable, type ListColumn } from "@/components/panel/list-table";
import { PanelDialog } from "@/components/panel/panel-dialog";
import { EmptyState, Field, IconAction, InitialsAvatar, Page, PageHeader, PanelButton, SearchField, ToolbarSelect } from "@/components/panel/primitives";
import { RowMenu } from "@/components/panel/row-menu";
import { formatInstant, todayKey } from "@/lib/agenda-time";
import { normalizeAppointmentFilters } from "@/lib/appointment-filters";
import { getInitials, plural } from "@/lib/format";
import { EmployeeForm } from "./components/EmployeeForm";

const addEmployeeSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type AddEmployeeForm = z.infer<typeof addEmployeeSchema>;

const ROLE_LABELS: Record<string, string> = { owner: "Proprietária(o)", admin: "Administrador", staff: "Equipe", employee: "Profissional" };

/**
 * Profissionais: equipe com função, data de entrada e carga do dia; convite, edição e remoção.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function EmployeesPage() {
  const { profile } = useAuth();
  const { employees, loading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const today = todayKey();
  const todayFilters = useMemo(() => normalizeAppointmentFilters(new URLSearchParams(`view=day&date=${today}`)), [today]);
  const { appointments } = useAppointments(todayFilters, { fetchAll: true });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Employee["role"]>("employee");
  const [toDelete, setToDelete] = useState<Employee | null>(null);
  const form = useForm<AddEmployeeForm>({ resolver: zodResolver(addEmployeeSchema) });

  const todayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    appointments
      .filter((appointment) => appointment.status !== "cancelled")
      .forEach((appointment) => counts.set(appointment.employee_id, (counts.get(appointment.employee_id) ?? 0) + 1));
    return counts;
  }, [appointments]);

  const rows = employees.filter((employee) =>
    (!roleFilter || employee.role === roleFilter)
    && (!search.trim() || employee.full_name.toLowerCase().includes(search.trim().toLowerCase()) || employee.email?.toLowerCase().includes(search.trim().toLowerCase())));

  /**
   * Cria o acesso do novo profissional via Edge Function.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const onInvite = async (data: AddEmployeeForm) => {
    setCreating(true);
    try {
      await createEmployee(data);
      form.reset();
      setInviteOpen(false);
      toast.success("Profissional adicionado à equipe.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível adicionar o profissional.");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setEditName(employee.full_name);
    setEditRole(employee.role);
  };

  const saveEdit = async () => {
    if (!editing || editName.trim().length < 3) return;
    try {
      await updateEmployee(editing.id, { full_name: editName.trim(), ...(editing.role !== "owner" ? { role: editRole } : {}) });
      toast.success("Profissional atualizado.");
      setEditing(null);
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível atualizar o profissional."));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteEmployee(toDelete.id);
      toast.success("Profissional removido.");
      setToDelete(null);
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível remover. Verifique se há agendamentos vinculados."));
    }
  };

  const columns: ListColumn<Employee>[] = [
    {
      key: "name", header: "Profissional",
      render: (employee) => <ListPrimaryCell leading={<InitialsAvatar initials={getInitials(employee.full_name)} />} title={employee.full_name} subtitle={employee.email || "Sem e-mail"} />,
    },
    { key: "role", header: "Função", render: (employee) => <span className="whitespace-nowrap text-[13px] text-af-ink2">{ROLE_LABELS[employee.role] ?? "Profissional"}</span> },
    {
      key: "since", header: "Na equipe desde",
      render: (employee) => <span className="whitespace-nowrap text-[13px] text-af-ink2">{employee.created_at ? formatInstant(employee.created_at, { month: "short", year: "numeric" }) : "—"}</span>,
    },
    {
      key: "today", header: "Hoje", align: "right",
      render: (employee) => {
        const count = todayCounts.get(employee.id) ?? 0;
        return <span className="whitespace-nowrap text-[13px] text-af-ink">{count > 0 ? `${count} atend.` : "—"}</span>;
      },
    },
    {
      key: "actions", header: "", align: "right",
      render: (employee) => (
        <div className="flex gap-0.5">
          <IconAction icon="edit" label={`Editar ${employee.full_name}`} className="text-af-ink3" onClick={() => openEdit(employee)} />
          {employee.role !== "owner" && employee.id !== profile?.id && (
            <RowMenu items={[{ label: "Remover da equipe", icon: "person_remove", danger: true, onSelect: () => setToDelete(employee) }]} />
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow={plural(employees.length, "profissional", "profissionais")}
        title="Profissionais"
        actions={<PanelButton icon="add" onClick={() => setInviteOpen(true)}>Convidar profissional</PanelButton>}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar profissional" />
        <ToolbarSelect
          label="Função"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[{ value: "", label: "Todas as funções" }, { value: "owner", label: "Proprietária(o)" }, { value: "admin", label: "Administrador" }, { value: "employee", label: "Profissional" }, { value: "staff", label: "Equipe" }]}
        />
      </div>

      <ListTable
        columns={columns}
        template="minmax(0,2.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr) 72px"
        rows={rows}
        rowKey={(employee) => employee.id}
        loading={loading}
        empty={
          <EmptyState
            icon="badge"
            title={employees.length === 0 ? "Equipe vazia" : "Nenhum profissional encontrado"}
            description={employees.length === 0 ? "Convide quem atende para distribuir a agenda." : "Tente outro nome ou função."}
          />
        }
        footer={<span>{plural(employees.length, "membro na equipe", "membros na equipe")}</span>}
      />

      <EmployeeForm isOpen={inviteOpen} onOpenChange={setInviteOpen} form={form} onSubmit={(data) => void onInvite(data)} creating={creating} />

      <PanelDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        width={440}
        title="Editar profissional"
        footer={
          <>
            <div className="flex-1" />
            <PanelButton variant="ghost" size="md" onClick={() => setEditing(null)}>Cancelar</PanelButton>
            <PanelButton variant="primary" size="md" disabled={editName.trim().length < 3} onClick={() => void saveEdit()}>Salvar alterações</PanelButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nome completo" htmlFor="edit-employee-name">
            <input id="edit-employee-name" className="af-input" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </Field>
          {editing?.role !== "owner" && (
            <Field label="Função" htmlFor="edit-employee-role" hint="Administradores acessam serviços, equipe e configurações.">
              <select id="edit-employee-role" className="af-input" value={editRole} onChange={(event) => setEditRole(event.target.value as Employee["role"])}>
                <option value="employee">Profissional</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>
          )}
        </div>
      </PanelDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remover da equipe?"
        description={`${toDelete?.full_name ?? "O profissional"} perde o acesso ao painel. Essa ação não pode ser desfeita.`}
        confirmLabel="Remover"
        onConfirm={() => void handleDelete()}
      />
    </Page>
  );
}
