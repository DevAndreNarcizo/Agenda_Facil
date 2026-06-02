import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EmployeeCardItem {
  id: string;
  full_name: string;
  role: string;
}

interface EmployeesTableProps {
  employees: EmployeeCardItem[];
  getTodayCount: (empId: string) => number;
  getRoleLabel: (role: string) => string;
  onEdit: (employee: EmployeeCardItem) => void;
  onDelete: (id: string, name: string) => void;
  onAdd: () => void;
}

export function EmployeesTable({
  employees,
  getTodayCount,
  getRoleLabel,
  onEdit,
  onDelete,
  onAdd,
}: EmployeesTableProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {employees.map((employee) => {
        const todayCount = getTodayCount(employee.id);
        return (
          <Card
            key={employee.id}
            className="group overflow-hidden border-0 bg-stitch-surface-container-lowest hover:shadow-2xl hover:shadow-stitch-primary/10 transition-all duration-300"
          >
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
                  onClick={() => onEdit(employee)}
                >
                  <span className="material-symbols-outlined text-lg mr-2">edit</span>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 rounded-xl h-11 font-bold text-stitch-error hover:bg-stitch-error/10 hover:text-stitch-error"
                  onClick={() => onDelete(employee.id, employee.full_name)}
                >
                  <span className="material-symbols-outlined text-lg mr-2">delete</span>
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <button
        onClick={onAdd}
        aria-label="Adicionar novo profissional"
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
  );
}
