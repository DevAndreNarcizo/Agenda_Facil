import { useMemo, useState } from "react";
import { toast } from "sonner";
import { describeError } from "@/hooks/use-organization";
import { useServices, type Service, type ServiceInput } from "@/hooks/use-services";
import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { ListPrimaryCell, ListTable, type ListColumn } from "@/components/panel/list-table";
import { EmptyState, IconAction, InitialsAvatar, Page, PageHeader, PanelButton, SearchField, ToolbarSelect } from "@/components/panel/primitives";
import { RowMenu } from "@/components/panel/row-menu";
import { formatCurrency, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ServiceForm } from "./components/ServiceForm";

const DEFAULT_FORM: ServiceInput = { name: "", duration_minutes: 30, price: 0, description: "" };
type StatusFilter = "all" | "active" | "inactive";

/**
 * Serviços: catálogo com busca, filtro de status, ativação e CRUD.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function ServicesPage() {
  const { services, loading, saveService, setServiceActive, deleteService, saving } = useServices();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceInput>(DEFAULT_FORM);
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const activeCount = services.filter((service) => service.is_active).length;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services.filter((service) =>
      (status === "all" || (status === "active") === service.is_active)
      && (!term || service.name.toLowerCase().includes(term) || service.description?.toLowerCase().includes(term)));
  }, [services, search, status]);

  const openModal = (service?: Service) => {
    setEditing(service ?? null);
    setFormData(service ? { name: service.name, duration_minutes: service.duration_minutes, price: service.price, description: service.description ?? "" } : DEFAULT_FORM);
    setModalOpen(true);
  };

  /**
   * Persiste o serviço e fecha o modal em caso de sucesso.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await saveService(formData, editing?.id);
      toast.success(editing ? "Serviço atualizado." : "Serviço cadastrado.");
      setModalOpen(false);
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível salvar o serviço. Verifique os dados."));
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      await setServiceActive(service.id, !service.is_active);
      toast.success(service.is_active ? "Serviço desativado. Ele some da reserva online." : "Serviço ativado.");
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível alterar o status do serviço."));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteService(toDelete.id);
      toast.success("Serviço removido.");
      setToDelete(null);
    } catch (cause) {
      toast.error(describeError(cause, "Não foi possível remover. Se houver agendamentos vinculados, desative o serviço."));
    }
  };

  const columns: ListColumn<Service>[] = [
    {
      key: "name", header: "Serviço",
      render: (service) => <ListPrimaryCell leading={<InitialsAvatar icon="spa" square />} title={service.name} subtitle={service.description || "Sem descrição"} />,
    },
    { key: "duration", header: "Duração", render: (service) => <span className="whitespace-nowrap text-[13px] text-af-ink2">{service.duration_minutes} min</span> },
    { key: "price", header: "Preço", align: "right", render: (service) => <span className="whitespace-nowrap text-[13px] text-af-ink">{formatCurrency(service.price)}</span> },
    {
      key: "status", header: "Status",
      render: (service) => (
        <span className={cn("flex items-center gap-1.5 whitespace-nowrap text-[13px]", service.is_active ? "text-af-ink" : "text-af-ink3")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", service.is_active ? "bg-af-ok" : "bg-af-ink3")} />
          {service.is_active ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions", header: "", align: "right",
      render: (service) => (
        <div className="flex gap-0.5">
          <IconAction icon="edit" label={`Editar ${service.name}`} className="text-af-ink3" onClick={() => openModal(service)} />
          <RowMenu
            items={[
              { label: service.is_active ? "Desativar" : "Ativar", icon: service.is_active ? "visibility_off" : "visibility", onSelect: () => void toggleActive(service) },
              { label: "Excluir serviço", icon: "delete", danger: true, onSelect: () => setToDelete(service) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow={plural(activeCount, "serviço ativo", "serviços ativos")}
        title="Serviços"
        actions={<PanelButton icon="add" onClick={() => openModal()}>Novo serviço</PanelButton>}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar serviço" />
        <ToolbarSelect
          label="Status"
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
          options={[{ value: "all", label: "Todos os status" }, { value: "active", label: "Ativos" }, { value: "inactive", label: "Inativos" }]}
        />
      </div>

      <ListTable
        columns={columns}
        template="minmax(0,2.4fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.9fr) 72px"
        rows={rows}
        rowKey={(service) => service.id}
        loading={loading}
        empty={
          <EmptyState
            icon="spa"
            title={services.length === 0 ? "Nenhum serviço cadastrado" : "Nenhum serviço encontrado"}
            description={services.length === 0 ? "Cadastre seus serviços para abrir a agenda ao público." : "Tente outro termo ou status."}
            action={services.length === 0 && <PanelButton variant="primary" icon="add" onClick={() => openModal()}>Cadastrar serviço</PanelButton>}
          />
        }
        footer={<span>Mostrando {rows.length} de {plural(services.length, "serviço")}</span>}
      />

      <ServiceForm
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        isEditing={editing !== null}
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSave}
        saving={saving}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir serviço?"
        description={`${toDelete?.name ?? "O serviço"} sai do catálogo e da reserva online. Para manter o histórico, prefira desativar.`}
        confirmLabel="Excluir serviço"
        onConfirm={() => void handleDelete()}
      />
    </Page>
  );
}
