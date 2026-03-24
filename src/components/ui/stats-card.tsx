

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  colorClass?: string;
}

export function StatsCard({ title, value, icon, description, trend = "neutral", colorClass = "border-stitch-primary" }: StatsCardProps) {
  return (
    <div className={`bg-stitch-surface-container-lowest p-8 rounded-[2rem] border-l-8 ${colorClass} flex items-center justify-between shadow-sm hover:translate-y-[-4px] transition-all duration-300 border-stitch-outline-variant/10`}>
      <div>
        <p className="text-stitch-on-surface-variant text-xs font-black uppercase tracking-widest mb-2 opacity-60">{title}</p>
        <h3 className="text-4xl font-black text-stitch-on-surface tracking-tighter">{value}</h3>
        {description && (
          <p className={`text-[11px] mt-2 font-bold uppercase tracking-wider flex items-center gap-1 ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-stitch-on-surface-variant opacity-40'
          }`}>
            <span className="material-symbols-outlined text-sm">
              {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'stadium'}
            </span>
            {description}
          </p>
        )}
      </div>
      <div className={`w-16 h-16 rounded-[1.25rem] bg-stitch-surface-container-low text-stitch-primary flex items-center justify-center shadow-inner`}>
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
    </div>
  );
}
