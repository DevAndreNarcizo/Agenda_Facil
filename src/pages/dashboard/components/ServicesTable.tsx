import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
}

interface ServicesTableProps {
  services: ServiceRow[];
  loading: boolean;
  onEdit: (service: ServiceRow) => void;
  onDelete: (id: string) => void;
  onAddFirst: () => void;
}

export function ServicesTable({ services, loading, onEdit, onDelete, onAddFirst }: ServicesTableProps) {
  return (
    <div className="bg-stitch-surface-container-low/30 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-stitch-surface-container-low/50 hover:bg-transparent border-0">
              <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Serviço</TableHead>
              <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Preço</TableHead>
              <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest">Duração</TableHead>
              <TableHead className="px-8 py-6 text-xs font-black text-stitch-on-surface-variant uppercase tracking-widest text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
                    <p className="font-bold text-stitch-on-surface-variant">Carregando catálogo...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : services.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-center py-32 bg-transparent border-0">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-stitch-surface-container flex items-center justify-center text-stitch-on-surface-variant/40">
                      <span className="material-symbols-outlined text-5xl">inventory_2</span>
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="font-black text-2xl text-stitch-on-surface">Nenhum serviço disponível</p>
                      <p className="text-stitch-on-surface-variant font-medium opacity-60 max-w-xs mx-auto">
                        Comece cadastrando seus serviços para abrir sua agenda ao seu público.
                      </p>
                    </div>
                    <Button
                      onClick={onAddFirst}
                      className="rounded-xl h-12 px-8 font-black shadow-lg shadow-stitch-primary/20"
                    >
                      Cadastrar Primeiro Serviço
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <TableRow
                  key={service.id}
                  className="bg-stitch-surface-container-lowest hover:bg-stitch-primary/5 transition-colors border-b border-stitch-outline-variant/10"
                >
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary shadow-sm">
                        <span className="material-symbols-outlined">auto_fix_high</span>
                      </div>
                      <div>
                        <p className="font-black text-stitch-on-surface text-lg leading-tight">{service.name}</p>
                        <p className="text-xs font-medium text-stitch-on-surface-variant opacity-60 leading-tight">
                          {service.description || "Sem descrição informada"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <p className="text-xl font-black text-stitch-on-surface">R$ {service.price.toFixed(2)}</p>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <Badge variant="secondary" className="px-3 py-1 font-black text-sm rounded-xl gap-2">
                      <span className="material-symbols-outlined text-base">schedule</span>
                      {service.duration_minutes} min
                    </Badge>
                  </TableCell>
                  <TableCell className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl hover:bg-stitch-primary/10 hover:text-stitch-primary"
                        onClick={() => onEdit(service)}
                        aria-label={`Editar serviço ${service.name}`}
                      >
                        <span className="material-symbols-outlined text-2xl">edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl hover:bg-stitch-error/10 hover:text-stitch-error"
                        onClick={() => onDelete(service.id)}
                        aria-label={`Remover serviço ${service.name}`}
                      >
                        <span className="material-symbols-outlined text-2xl">delete_sweep</span>
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
