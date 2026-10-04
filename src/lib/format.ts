const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Formata valor em reais com espaço inseparável entre "R$" e o número (evita quebra de linha).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatCurrency(value: number, options: { compact?: boolean } = {}): string {
  const formatter = options.compact ? compactCurrencyFormatter : currencyFormatter;
  return formatter.format(Number.isFinite(value) ? value : 0).replace(/\s/, " ");
}

/**
 * Gera iniciais (até 2 letras) a partir de um nome completo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/**
 * Tempo relativo curto em pt-BR ("agora", "5 min", "2 h", "3 d").
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatRelativeShort(date: Date | string, now: Date = new Date()): string {
  const diffMinutes = Math.max(0, Math.round((now.getTime() - new Date(date).getTime()) / 60_000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

/**
 * Converte telefone brasileiro em link do WhatsApp (wa.me), adicionando DDI 55 quando ausente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function toWhatsAppUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

/**
 * Pluraliza um substantivo simples em pt-BR com base na contagem.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
