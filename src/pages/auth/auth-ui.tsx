import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import logoMark from "@/assets/logo-mark.png";
import { Icon } from "@/components/panel/primitives";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuthProviders } from "@/hooks/use-auth-providers";
import {
  BUSINESS_SEGMENTS,
  PASSWORD_STRENGTH_LABEL,
  describeAuthError,
  type BusinessSegment,
  type PasswordStrength,
} from "@/lib/auth-form";

/**
 * Casca das telas de autenticação (entrar, criar conta, recuperar senha) no design system AgendaFácil:
 * marca + texto de apoio no topo e conteúdo em coluna de até 400px. No celular o conteúdo fica
 * direto sobre o fundo (como no protótipo mobile); a partir de `sm` ganha um cartão com borda.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthLayout({ lead, children }: { lead: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="af-root flex min-h-dvh flex-col bg-af-bg text-af-ink">
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10 sm:py-14">
        <header className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <Link to="/login" aria-label="AgendaFácil" className="rounded-af focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent">
            <img src={logoMark} alt="" width={64} height={64} className="h-16 w-16" />
          </Link>
          <span className="text-[22px] font-bold tracking-[-0.03em]">
            Agenda<span className="text-af-accent">Fácil</span>
          </span>
          <p className="max-w-[300px] text-sm text-af-ink2 [text-wrap:pretty]">{lead}</p>
        </header>
        <div className="flex flex-col gap-5 sm:rounded-af-lg sm:border sm:border-af-line sm:bg-af-surface sm:p-7 sm:shadow-[0_1px_2px_rgba(9,35,67,0.04)]">
          {children}
        </div>
        <footer className="mt-6 flex justify-center gap-4 text-xs text-af-ink3">
          <Link to="/termos" className="hover:text-af-ink">Termos de uso</Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacidade" className="hover:text-af-ink">Privacidade</Link>
        </footer>
      </main>
    </div>
  );
}

/**
 * Abas Entrar / Criar conta. São links (rotas próprias), então funcionam com voltar do navegador
 * e podem ser compartilhadas; visualmente seguem o controle segmentado do protótipo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthModeTabs({ active }: { active: "login" | "register" }) {
  const tabs = [
    { key: "login", label: "Entrar", to: "/login" },
    { key: "register", label: "Criar conta", to: "/register" },
  ] as const;
  return (
    <nav aria-label="Acesso" className="grid grid-cols-2 gap-0.5 rounded-af bg-af-surface2 p-[3px]">
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            replace
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-[38px] items-center justify-center rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent",
              current ? "bg-af-surface font-semibold text-af-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-af-ink2 hover:text-af-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: string;
  hint?: React.ReactNode;
  error?: string;
  /** Conteúdo à direita do rótulo (ex.: link "Esqueci a senha"). */
  labelAside?: React.ReactNode;
};

/**
 * Campo de 48px com ícone à esquerda, fonte de 16px (evita zoom automático no iOS) e borda
 * vermelha + mensagem quando inválido. Em `type="password"` mostra o botão de exibir senha.
 * Usa forwardRef para funcionar direto com `register()` do react-hook-form.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ id, label, icon, hint, error, labelAside, type = "text", className, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false);
    const isPassword = type === "password";
    const describedBy = error || hint ? `${id}-desc` : undefined;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
          {labelAside}
        </div>
        <div className="relative flex items-center">
          <Icon name={icon} className="pointer-events-none absolute left-3 text-af-ink3" />
          <input
            ref={ref}
            id={id}
            type={isPassword && revealed ? "text" : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "h-12 w-full rounded-af border bg-af-surface pl-[42px] text-base text-af-ink outline-none transition-colors placeholder:text-af-ink3 focus:ring-[3px]",
              isPassword ? "pr-11" : "pr-3",
              error ? "border-af-bad focus:ring-af-bad-soft" : "border-af-line2 focus:border-af-accent focus:ring-af-accent-soft",
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={revealed}
              className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-af-ink3 hover:text-af-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent"
            >
              <Icon name={revealed ? "visibility_off" : "visibility"} />
            </button>
          )}
        </div>
        {(error || hint) && (
          <span id={describedBy} className={cn("text-xs", error ? "text-af-bad" : "text-af-ink3")}>
            {error ?? hint}
          </span>
        )}
      </div>
    );
  },
);
AuthField.displayName = "AuthField";

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  0: "bg-af-line",
  1: "bg-af-bad",
  2: "bg-af-pend",
  3: "bg-af-accent",
  4: "bg-af-ok",
};

/**
 * Medidor de força da senha em 4 barras (fraca → forte), anunciado a leitores de tela.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  return (
    <div className="-mt-2 flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span key={bar} className={cn("h-1 rounded-sm transition-colors", bar <= strength ? STRENGTH_COLOR[strength] : "bg-af-line")} />
        ))}
      </div>
      <span className="text-xs text-af-ink3" aria-live="polite">{PASSWORD_STRENGTH_LABEL[strength]}</span>
    </div>
  );
}

/**
 * Checkbox nativo (acessível e compatível com react-hook-form) com a aparência do protótipo:
 * quadrado de 20px, azul quando marcado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const AuthCheckbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; error?: string }>(
  ({ id, label, error, className, ...props }, ref) => (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.45] text-af-ink2">
        <span className="relative mt-px flex h-5 w-5 shrink-0">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            className={cn(
              "peer h-5 w-5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] bg-af-surface transition-colors checked:border-af-accent checked:bg-af-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent focus-visible:ring-offset-1",
              error ? "border-af-bad" : "border-af-line2",
            )}
            {...props}
          />
          <Icon name="check" size={15} className="pointer-events-none absolute inset-0 m-auto h-fit w-fit text-white opacity-0 peer-checked:opacity-100" />
        </span>
        <span>{label}</span>
      </label>
      {error && <span className="pl-[30px] text-xs text-af-bad">{error}</span>}
    </div>
  ),
);
AuthCheckbox.displayName = "AuthCheckbox";

/**
 * Caixa de erro do formulário (fundo vermelho suave), anunciada como alerta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-af bg-af-bad-soft px-3 py-2.5 text-[13px] text-af-bad">
      <Icon name="error" size={18} className="mt-px" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Botão principal de 48px; mostra spinner e rótulo de progresso enquanto envia.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthSubmit({ loading, loadingLabel, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-af bg-af-accent text-[15px] font-semibold text-af-on-accent transition-colors hover:bg-af-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent focus-visible:ring-offset-2 focus-visible:ring-offset-af-surface disabled:cursor-wait disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {loading ? loadingLabel : children}
    </button>
  );
}

/**
 * Linha de troca de modo no rodapé ("Ainda não tem conta? Criar conta").
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthSwitch({ text, cta, to }: { text: string; cta: string; to: string }) {
  return (
    <p className="text-center text-[13px] text-af-ink2">
      {text}{" "}
      <Link to={to} className="font-semibold text-af-accent hover:underline">{cta}</Link>
    </p>
  );
}

/**
 * Estado de confirmação (e-mail enviado, senha alterada, link inválido): ícone, título, texto e ação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthNotice({ icon, tone = "accent", title, children, action }: {
  icon: string;
  tone?: "accent" | "bad";
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
      <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", tone === "bad" ? "bg-af-bad-soft text-af-bad" : "bg-af-accent-soft text-af-accent")}>
        <Icon name={icon} size={24} />
      </span>
      <h1 className="text-lg font-semibold tracking-[-0.01em]">{title}</h1>
      <p className="text-sm text-af-ink2 [text-wrap:pretty]">{children}</p>
      {action && <div className="mt-2 w-full">{action}</div>}
    </div>
  );
}

/**
 * Link de texto secundário em azul (ex.: "Esqueci a senha", "Voltar para o login").
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function AuthLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("text-[13px] font-medium text-af-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent", className)}>
      {children}
    </Link>
  );
}

/**
 * Bloco "ou" + botões Google/WhatsApp. Cada botão só aparece com o provedor ativo no Supabase
 * (ver useAuthProviders); sem nenhum ativo, o bloco inteiro some.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function SocialAuth({ onError, beforeAuth }: { onError: (message: string) => void; beforeAuth?: () => void }) {
  const providers = useAuthProviders();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = React.useState(false);

  if (!providers.google && !providers.whatsapp) return null;

  /**
   * Inicia o OAuth do Google; o Supabase volta para /dashboard, e o ProtectedRoute leva ao
   * onboarding quem ainda não tem empresa.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const signInWithGoogle = async (): Promise<void> => {
    beforeAuth?.();
    setRedirecting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setRedirecting(false);
      onError(describeAuthError(error, "Não foi possível entrar com o Google."));
    }
  };

  const buttonClass =
    "flex h-[46px] items-center justify-center gap-2 rounded-af border border-af-line2 bg-af-surface text-sm font-medium text-af-ink transition-colors hover:bg-af-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent disabled:opacity-60";

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-af-ink3" aria-hidden="true">
        <span className="h-px flex-1 bg-af-line" />ou<span className="h-px flex-1 bg-af-line" />
      </div>
      <div className={cn("grid gap-2", providers.google && providers.whatsapp ? "grid-cols-2" : "grid-cols-1")}>
        {providers.google && (
          <button type="button" className={buttonClass} onClick={() => void signInWithGoogle()} disabled={redirecting}>
            <GoogleMark />Google
          </button>
        )}
        {providers.whatsapp && (
          <button type="button" className={buttonClass} onClick={() => { beforeAuth?.(); navigate("/login/whatsapp"); }}>
            <Icon name="chat" size={19} />WhatsApp
          </button>
        )}
      </div>
    </>
  );
}

/**
 * "G" do Google nas cores oficiais (uso permitido pelas diretrizes de marca do Sign in with Google).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Chips de segmento do negócio (Estética, Beleza, Cabelo, Pet) como grupo de rádio acessível.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function SegmentChips({ value, onChange, error }: { value?: BusinessSegment; onChange: (value: BusinessSegment) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span id="segment-label" className="text-[13px] font-medium">Segmento</span>
      <div role="radiogroup" aria-labelledby="segment-label" className="flex flex-wrap gap-2">
        {BUSINESS_SEGMENTS.map((segment) => {
          const active = segment.value === value;
          return (
            <button
              key={segment.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(segment.value)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent",
                active ? "border-af-accent bg-af-accent-soft font-medium text-af-accent" : "border-af-line2 bg-af-surface text-af-ink2 hover:text-af-ink",
              )}
            >
              <Icon name={segment.icon} size={17} />
              {segment.label}
            </button>
          );
        })}
      </div>
      {error && <span className="text-xs text-af-bad">{error}</span>}
    </div>
  );
}

/**
 * Link para Termos/Privacidade que abre em nova aba, para não perder o formulário preenchido.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function LegalLink({ to, children }: { to: "/termos" | "/privacidade"; children: React.ReactNode }) {
  return (
    <Link to={to} target="_blank" rel="noopener" className="text-af-accent underline-offset-2 hover:underline" onClick={(event) => event.stopPropagation()}>
      {children}
    </Link>
  );
}
