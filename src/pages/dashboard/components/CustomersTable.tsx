import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  last_appointment?: string | null;
  total_appointments?: number;
}

interface CustomersTableProps {
  customers: CustomerRow[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
  onEdit: (customer: CustomerRow) => void;
  onDelete: (id: string) => void;
  formatDate: (dateStr: string | null | undefined) => string;
}

export function CustomersTable({
  customers,
  loading,
  currentPage,
  totalPages,
  totalFiltered,
  onPageChange,
  onEdit,
  onDelete,
  formatDate,
}: CustomersTableProps) {
  return (
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
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 bg-stitch-surface-container-lowest">
                  <div className="flex flex-col items-center gap-4 opacity-40">
                    <span className="material-symbols-outlined text-6xl">person_search</span>
                    <p className="font-bold text-lg">Nenhum cliente encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="bg-stitch-surface-container-lowest hover:bg-stitch-primary/5 transition-colors border-b border-stitch-outline-variant/10"
                >
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
                        <p className="text-xs font-medium text-stitch-on-surface-variant opacity-60 leading-tight">
                          {customer.email || "Sem email cadastrado"}
                        </p>
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
                        onClick={() => onEdit(customer)}
                        aria-label={`Editar cliente ${customer.name}`}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-stitch-error/10 hover:text-stitch-error"
                        onClick={() => onDelete(customer.id)}
                        aria-label={`Excluir cliente ${customer.name}`}
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
          Mostrando {customers.length} de {totalFiltered} clientes
        </p>
        <nav aria-label="Paginação" className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-stitch-outline-variant/20 bg-white shadow-sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            aria-label="Página anterior"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
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
                  aria-label={`Página ${page}`}
                  aria-current={page === currentPage ? "page" : undefined}
                  className={`h-10 w-10 rounded-xl font-black ${
                    page === currentPage
                      ? "bg-stitch-primary text-white shadow-md shadow-stitch-primary/20"
                      : "border-0 bg-transparent hover:bg-white text-stitch-on-surface-variant"
                  }`}
                  onClick={() => onPageChange(page)}
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
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            aria-label="Próxima página"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </Button>
        </nav>
      </div>
    </div>
  );
}
