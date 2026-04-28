/**
 * Normaliza campos de cliente antes de enviar para o Supabase.
 *
 * @author André Narcizo
 */
export function normalizeCustomerInput(customer: { name: string; phone: string; email?: string | null }) {
  const name = customer.name.trim();
  const phone = customer.phone.replace(/\D/g, "");
  const email = customer.email?.trim().toLowerCase() || null;

  return {
    name,
    phone,
    email,
  };
}

/**
 * Formata telefone brasileiro para exibição durante digitação.
 *
 * @author André Narcizo
 */
export function formatBrazilianPhone(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;

  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
}
