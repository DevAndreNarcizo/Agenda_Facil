import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomerFiltersProps {
  searchTerm: string;
  onSearch: (value: string) => void;
}

export function CustomerFilters({ searchTerm, onSearch }: CustomerFiltersProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold text-stitch-on-surface-variant ml-1">
        Pesquisar na base de clientes
      </Label>
      <div className="relative group">
        <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stitch-primary opacity-50 group-focus-within:opacity-100 transition-opacity text-2xl">
          search
        </span>
        <Input
          className="h-16 pl-14 text-lg bg-[#1a1c1e] text-white border-none rounded-2xl shadow-xl font-bold placeholder:text-white/20"
          placeholder="Nome, telefone ou email..."
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
}
