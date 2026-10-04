import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { describeError } from "@/hooks/use-organization";
import { useAuth } from "@/hooks/use-auth";
import { useCustomers } from "@/hooks/use-customers";
import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { ListPrimaryCell, ListTable, Pagination, type ListColumn } from "@/components/panel/list-table";
import { EmptyState, IconAction, InitialsAvatar, Page, PageHeader, PanelButton, SearchField, ToolbarSelect } from "@/components/panel/primitives";
import { RowMenu } from "@/components/panel/row-menu";
import { formatInstant } from "@/lib/agenda-time";
import { getInitials, plural, toWhatsAppUrl } from "@/lib/format";
import { CustomerModal, type CustomerFormData } from "./components/CustomerModal";

const ITEMS_PER_PAGE = 10;
const EMPTY_FORM: CustomerFormData = { name: "", phone: "", email: "" };

type CustomerRow = ReturnType<typeof useCustomers>["customers"][number];
type SortKey = "name" | "recent" | "visits";

/**
 * Clientes: busca (também pelo cabeçalho, via ?q=), ordenação, paginação e CRUD.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function CustomersPage() {
  const { profile } = useAuth();
  // Exclusão é restrita a owner/admin no banco (migration 20261004_000001); a interface acompanha.
  const canDelete = profile?.role === "owner" || profile?.role === "admin";
  const { customers, loading, newThisMonth, totalCustomers, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<CustomerRow | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const matches = customers.filter((customer) =>
      !term
      || customer.name.toLowerCase().includes(term)
      || (digits.length > 0 && customer.phone?.replace(/\D/g, "").includes(digits))
      || customer.email?.toLowerCase().includes(term));
    return [...matches].sort((a, b) => {
      if (sort === "recent") return (b.last_appointment ?? "").localeCompare(a.last_appointment ?? "");
      if (sort === "visits") return (b.total_appointments ?? 0) - (a.total_appointments ?? 0);
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [customers, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const setSearch = (value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("q", value);
      else next.delete("q");
      return next;
    }, { replace: true });
    setPage(1);
  };

  const openModal = (customer?: CustomerRow) => {
    setEditingId(customer?.id ?? null);
    setFormData(customer ? { name: customer.name, phone: customer.phone ?? "", email: customer.email ?? "" } : EMPTY_FORM);
    setModalOpen(true);
  };

  /**
   * Cria ou atualiza o cliente e fecha o modal em caso de sucesso.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.name.trim().length < 2) return;
    setSaving(true);
    const payload = { name: formData.name.trim(), phone: formData.phone.trim(), email: formData.email.trim() || undefined };
    try {
      if (editingId) await updateCustomer(editingId, payload);
      else await createCustomer(payload);
      toast.success(editingId ? "Cliente atualizado." : "Cliente cadastrado.");
      setModalOpen(false);
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível salvar o cliente. Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteCustomer(toDelete.id);
      toast.success("Cliente excluído.");
      setToDelete(null);
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível excluir. Verifique se há agendamentos vinculados."));
    }
  };

  const columns: ListColumn<CustomerRow>[] = [
    {
      key: "name", header: "Cliente",
      render: (customer) => (
        <ListPrimaryCell leading={<InitialsAvatar initials={getInitials(customer.name)} />} title={customer.name} subtitle={customer.email || "Sem e-mail cadastrado"} />
      ),
    },
    {
      key: "phone", header: "WhatsApp",
      render: (customer) => {
        const url = toWhatsAppUrl(customer.phone);
        return url
          ? <a href={url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-[13px] text-af-ink2 hover:text-af-accent">{customer.phone}</a>
          : <span className="text-[13px] text-af-ink3">—</span>;
      },
    },
    {
      key: "last", header: "Última visita",
      render: (customer) => (
        <span className="whitespace-nowrap text-[13px] text-af-ink2">
          {customer.last_appointment ? formatInstant(customer.last_appointment, { day: "2-digit", month: "short", year: "numeric" }) : "Sem visitas"}
        </span>
      ),
    },
    { key: "visits", header: "Visitas", align: "right", render: (customer) => <span className="text-[13px] text-af-ink">{customer.total_appointments ?? 0}</span> },
    {
      key: "actions", header: "", align: "right",
      render: (customer) => (
        <div className="flex gap-0.5 text-af-ink3">
          <IconAction icon="edit" label={`Editar ${customer.name}`} className="text-af-ink3" onClick={() => openModal(customer)} />
          {canDelete && <RowMenu items={[{ label: "Excluir cliente", icon: "delete", danger: true, onSelect: () => setToDelete(customer) }]} />}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow={`${plural(totalCustomers, "cliente")}${newThisMonth > 0 ? ` · ${newThisMonth} novos no mês` : ""}`}
        title="Clientes"
        actions={<PanelButton icon="add" onClick={() => openModal()}>Novo cliente</PanelButton>}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar por nome ou telefone" />
        <ToolbarSelect
          label="Ordenar por"
          value={sort}
          onChange={(value) => setSort(value as SortKey)}
          options={[{ value: "name", label: "Nome" }, { value: "recent", label: "Última visita" }, { value: "visits", label: "Mais visitas" }]}
        />
      </div>

      <ListTable
        columns={columns}
        template="minmax(0,2.2fr) minmax(0,1.3fr) minmax(0,1fr) 70px 72px"
        rows={rows}
        rowKey={(customer) => customer.id}
        loading={loading}
        empty={
          <EmptyState
            icon="group"
            title={search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            description={search ? "Tente outro nome ou telefone." : "Clientes que reservam pelo link entram aqui automaticamente."}
            action={!search && <PanelButton icon="add" onClick={() => openModal()}>Novo cliente</PanelButton>}
          />
        }
        footer={
          <>
            <span>Mostrando {rows.length} de {plural(filtered.length, "cliente")}</span>
            {pageCount > 1 && <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />}
          </>
        }
      />

      <CustomerModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        isEditing={editingId !== null}
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSave}
        saving={saving}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir cliente?"
        description={`${toDelete?.name ?? "O cliente"} será removido da sua base. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir cliente"
        onConfirm={() => void handleDelete()}
      />
    </Page>
  );
}
