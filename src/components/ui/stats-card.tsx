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
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-600",
  }[trend];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className={`text-xs ${trendColor} mt-1`}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
