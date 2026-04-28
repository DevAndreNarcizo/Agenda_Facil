import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notification {
  id: string;
  type: "appointment" | "info";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export function NotificationsPanel() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const organizationId = profile?.organization_id;

  /**
   * Busca notificações operacionais da organização atual sem bloquear a UI.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const { data: fetchedNotifications = [] } = useQuery({
    queryKey: ["dashboard-notifications", organizationId],
    enabled: !!organizationId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Notification[]> => {
      if (!organizationId) return [];

      try {
        // Buscar agendamentos pendentes (últimas 24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: pendingAppointments } = await supabase
          .from("appointments")
          .select("id, customer_name, start_time, status")
          .eq("organization_id", organizationId)
          .eq("status", "pending")
          .gte("created_at", yesterday.toISOString())
          .order("created_at", { ascending: false })
          .limit(10);

        const items: Notification[] = [];

        if (pendingAppointments) {
          for (const apt of pendingAppointments) {
            const date = new Date(apt.start_time);
            items.push({
              id: apt.id,
              type: "appointment",
              title: "Novo agendamento pendente",
              message: `${apt.customer_name} agendou para ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
              time: formatRelativeTime(new Date(apt.start_time)),
              read: false,
            });
          }
        }

        // Buscar agendamentos de hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: todayAppointments } = await supabase
          .from("appointments")
          .select("id")
          .eq("organization_id", organizationId)
          .gte("start_time", today.toISOString())
          .lt("start_time", tomorrow.toISOString())
          .neq("status", "cancelled");

        if (todayAppointments && todayAppointments.length > 0) {
          items.push({
            id: "today-summary",
            type: "info",
            title: "Agenda de hoje",
            message: `Você tem ${todayAppointments.length} agendamento${todayAppointments.length > 1 ? "s" : ""} hoje.`,
            time: "Hoje",
            read: true,
          });
        }

        return items;
      } catch {
        return [];
      }
    },
  });

  const notifications = fetchedNotifications.map((notification) => ({
    ...notification,
    read: notification.read || readIds.has(notification.id),
  }));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-2.5 text-stitch-on-surface-variant hover:bg-stitch-primary/10 hover:text-stitch-primary transition-all rounded-full relative group"
          aria-label="Abrir notificações"
        >
          <span className="material-symbols-outlined font-black">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-stitch-primary text-stitch-on-primary text-[10px] font-black rounded-full flex items-center justify-center px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0 rounded-2xl bg-stitch-surface border border-stitch-outline-variant/20 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stitch-outline-variant/10">
          <h3 className="font-black text-stitch-on-surface text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs font-bold text-stitch-primary hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-stitch-on-surface-variant/30 block mb-2">notifications_off</span>
              <p className="text-sm text-stitch-on-surface-variant">Nenhuma notificação no momento.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 p-4 border-b border-stitch-outline-variant/5 transition-colors ${
                  n.read ? "" : "bg-stitch-primary/5"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === "appointment"
                      ? "bg-stitch-primary/10 text-stitch-primary"
                      : "bg-stitch-secondary/10 text-stitch-secondary"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {n.type === "appointment" ? "calendar_month" : "info"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stitch-on-surface">{n.title}</p>
                  <p className="text-xs text-stitch-on-surface-variant mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] font-bold text-stitch-on-surface-variant/60 mt-1">{n.time}</p>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-stitch-primary shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";
  if (diffDays > 1) return `Em ${diffDays} dias`;
  return `${Math.abs(diffDays)} dias atrás`;
}
