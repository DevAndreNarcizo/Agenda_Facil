

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  colorClass?: string;
}

export function StatsCard({ title, value, icon, description, trend = "neutral", colorClass = "border-stitch-primary" }: StatsCardProps) {
  const accent =
    colorClass.includes("secondary") ? "var(--af-secondary)" :
    colorClass.includes("tertiary") ? "var(--af-tertiary)" :
    colorClass.includes("outline") ? "var(--af-on-surface-variant)" :
    "var(--af-primary)";

  const accentBg =
    colorClass.includes("secondary") ? "rgba(63,225,253,0.18)" :
    colorClass.includes("tertiary") ? "rgba(144,67,88,0.10)" :
    colorClass.includes("outline") ? "var(--af-surface-low)" :
    "var(--af-primary-soft)";

  return (
    <div className="af-card af-card-hover relative overflow-hidden p-[22px]">
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: accentBg, color: accent, boxShadow: "var(--af-shadow-inner)" }}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        {description && (
          <p
            className="flex items-center gap-1 text-[11px] font-extrabold"
            style={{
              color: trend === "up" ? "var(--af-success)" : trend === "down" ? "var(--af-error)" : "var(--af-on-surface-variant)",
            }}
          >
            <span className="material-symbols-outlined text-sm">
              {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'monitoring'}
            </span>
            {description}
          </p>
        )}
      </div>
      <p className="af-eb mb-1.5 text-stitch-on-surface-variant/60">{title}</p>
      <h3 className="af-num font-headline text-[30px] font-black leading-none tracking-[-0.03em] text-stitch-on-surface">{value}</h3>
    </div>
  );
}
