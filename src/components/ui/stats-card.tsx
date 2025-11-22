import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

// Interface para as props do StatsCard
interface StatsCardProps {
  title: string; // Título do card (ex: "Total de Agendamentos")
  value: string | number; // Valor principal a ser exibido
  icon: LucideIcon; // Ícone do lucide-react
  description?: string; // Descrição opcional (ex: "+20% em relação ao mês passado")
  trend?: "up" | "down" | "neutral"; // Tendência para colorir a descrição
}

export function StatsCard({ title, value, icon: Icon, description, trend = "neutral" }: StatsCardProps) {
  // Define a cor da tendência
  const trendColor = {
    up: "text-emerald-500",
    down: "text-rose-500",
    neutral: "text-muted-foreground",
  }[trend];

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/10 hover:scale-[1.02] transition-all duration-300 hover:shadow-lg hover:border-primary/20 group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          {title}
        </CardTitle>
        <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {description && (
          <p className={`text-xs ${trendColor} mt-1 font-medium`}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
