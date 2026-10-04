import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { STATUS_META, type AgendaItemKind } from "@/lib/appointment-status";

/**
 * Ícone Material Symbols com tamanho e preenchimento controlados (peso 350 do painel refinado).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Icon({ name, size = 20, fill = false, className, ...rest }: { name: string; size?: number; fill?: boolean } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined shrink-0 select-none", className)}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 350, 'GRAD' 0, 'opsz' 20` }}
      {...rest}
    >
      {name}
    </span>
  );
}

/**
 * Cabeçalho de página: rótulo de contexto (eyebrow), título e ações à direita.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function PageHeader({ eyebrow, title, actions }: { eyebrow: React.ReactNode; title: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-none flex-col gap-1.5">
        <span className="text-[13px] text-af-ink3">{eyebrow}</span>
        <h1 className="m-0 font-sans text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-af-ink">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

/**
 * Superfície padrão (card) com borda fina e raio 12px.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-af-lg border border-af-line bg-af-surface", className)} {...props} />;
}

/**
 * Cabeçalho de seção dentro de um Panel (título 15px/600 e ação opcional).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function PanelHeader({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-af-line px-5 py-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 font-sans text-[15px] font-semibold text-af-ink">{title}</h2>
        {subtitle && <span className="text-xs text-af-ink3">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

export interface KpiItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subClassName?: string;
}

/**
 * Faixa única de métricas (4 → 2 → 1 colunas), separadas por linhas de 1px.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function KpiStrip({ items, children }: { items?: KpiItem[]; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-af-lg border border-af-line bg-af-line min-[480px]:grid-cols-2 min-[900px]:grid-cols-4">
      {items?.map((item) => (
        <KpiCell key={item.label} label={item.label} value={item.value} sub={item.sub} subClassName={item.subClassName} />
      ))}
      {children}
    </div>
  );
}

/**
 * Célula individual da KpiStrip; exportada para composições com conteúdo extra (ex.: barra de uso).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function KpiCell({ label, value, sub, subClassName, children }: KpiItem & { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 bg-af-surface px-5 py-[18px]">
      <span className="text-[13px] text-af-ink2">{label}</span>
      <span className="text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-af-ink">{value}</span>
      {sub && <span className={cn("text-xs text-af-ink3", subClassName)}>{sub}</span>}
      {children}
    </div>
  );
}

/**
 * Controle segmentado (ex.: Hoje/Semana, Mensal/Anual, Claro/Escuro).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Segmented<T extends string>({ options, value, onChange, size = "md", label }: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex w-fit rounded-lg bg-af-surface2 p-0.5", size === "sm" ? "text-xs" : "text-[13px]")}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent",
              size === "sm" ? "px-2.5 py-1" : "px-3 py-[5px]",
              active ? "bg-af-surface font-medium text-af-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-af-ink2 hover:text-af-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Botão do painel: primary (azul), secondary (contorno), ghost e danger (ação destrutiva discreta).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const PanelButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: string;
}>(({ variant = "secondary", size = "sm", icon, className, children, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent focus-visible:ring-offset-1 focus-visible:ring-offset-af-surface disabled:cursor-not-allowed disabled:opacity-45",
      size === "sm" && "h-8 px-3 text-[13px]",
      size === "md" && "h-9 px-3.5 text-[13px]",
      size === "lg" && "h-10 px-4 text-sm",
      variant === "primary" && "bg-af-accent text-af-on-accent hover:bg-af-accent-hover",
      variant === "secondary" && "border border-af-line2 bg-af-surface text-af-ink hover:bg-af-surface2",
      variant === "ghost" && "text-af-ink2 hover:bg-af-surface2 hover:text-af-ink",
      variant === "danger" && "border border-af-line2 bg-af-surface text-af-warn hover:bg-af-warn-soft",
      className,
    )}
    {...props}
  >
    {icon && <Icon name={icon} size={size === "lg" ? 18 : 17} />}
    {children}
  </button>
));
PanelButton.displayName = "PanelButton";

/**
 * Botão só com ícone (editar, mais, fechar); label obrigatório para acessibilidade.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const IconAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: number }>(
  ({ icon, label, size = 18, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-1.5 text-af-ink2 transition-colors hover:bg-af-surface2 hover:text-af-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  ),
);
IconAction.displayName = "IconAction";

/**
 * Indicador de status com ponto colorido (lista, agenda de hoje).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function StatusDot({ status, className }: { status: AgendaItemKind; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("flex items-center gap-1.5 text-[11px]", meta.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/**
 * Pílula de status com fundo claro (cabeçalho do detalhe do agendamento).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function StatusPill({ status }: { status: AgendaItemKind }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", meta.bg, meta.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/**
 * Tag pequena em pílula (ex.: "Plano atual", "Teste grátis").
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full bg-af-accent-soft px-2 py-[3px] text-[11px] font-medium text-af-accent", className)}>{children}</span>;
}

/**
 * Switch 34×20 do painel, sobre o primitivo acessível do Radix.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const PanelSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-5 w-[34px] shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:bg-af-accent data-[state=unchecked]:bg-af-line2",
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb className="pointer-events-none absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform data-[state=checked]:translate-x-3.5" />
  </SwitchPrimitives.Root>
));
PanelSwitch.displayName = "PanelSwitch";

/**
 * Campo de formulário: label 13px/500, controle e dica/erro opcionais.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Field({ label, htmlFor, hint, error, optional, className, children }: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-af-ink">
        {label}
        {optional && <span className="font-normal text-af-ink3"> (opcional)</span>}
      </label>
      {children}
      {error ? <span className="text-xs text-af-bad">{error}</span> : hint && <span className="text-xs text-af-ink3">{hint}</span>}
    </div>
  );
}

/**
 * Select nativo estilizado como filtro de toolbar (32–34px, borda fina, seta à direita).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ToolbarSelect({ label, value, onChange, options, className }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex h-8 shrink-0 items-center", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full cursor-pointer appearance-none rounded-lg border border-af-line bg-af-surface pl-2.5 pr-8 text-[13px] text-af-ink2 outline-none hover:bg-af-surface2 focus-visible:ring-2 focus-visible:ring-af-accent"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Icon name="expand_more" size={17} className="pointer-events-none absolute right-2 text-af-ink2" />
    </span>
  );
}

/**
 * Busca de lista (ícone + input), com largura fluida até 300px.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-[34px] w-full min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-lg border border-af-line bg-af-surface px-2.5 text-[13px] text-af-ink3 focus-within:border-af-accent">
      <Icon name="search" size={17} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-af-ink outline-none placeholder:text-af-ink3"
      />
    </label>
  );
}

/**
 * Avatar circular (ou quadrado arredondado) com iniciais e tom suave de destaque.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function InitialsAvatar({ initials, size = 32, square = false, muted = false, icon }: { initials?: string; size?: number; square?: boolean; muted?: boolean; icon?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        square ? "rounded-af" : "rounded-full",
        muted ? "bg-af-surface2 text-af-ink2" : "bg-af-accent-soft text-af-accent",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {icon ? <Icon name={icon} size={Math.round(size * 0.53)} /> : initials}
    </span>
  );
}

/**
 * Estado vazio compacto e calmo, com ação opcional.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Icon name={icon} size={28} className="text-af-ink3" />
      <span className="text-sm font-medium text-af-ink">{title}</span>
      {description && <span className="max-w-sm text-[13px] text-af-ink2 [text-wrap:pretty]">{description}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Bloco de carregamento (skeleton) com a cor de superfície rebaixada.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-af-lg bg-af-surface2", className)} />;
}

/**
 * Seção de configurações em duas colunas: descrição à esquerda, conteúdo à direita.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      <div className="flex max-w-[320px] flex-[1_1_220px] flex-col gap-1.5">
        <h2 className="m-0 font-sans text-[15px] font-semibold text-af-ink">{title}</h2>
        <p className="m-0 text-[13px] leading-normal text-af-ink2 [text-wrap:pretty]">{description}</p>
      </div>
      <div className="min-w-0 flex-[3_1_480px]">{children}</div>
    </div>
  );
}

/**
 * Pilha vertical de uma página do painel (gap 20px no mobile, 28px a partir de 720px).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-5 min-[720px]:gap-7", className)}>{children}</div>;
}
