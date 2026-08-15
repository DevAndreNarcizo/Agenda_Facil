/**
 * Aceita somente um retorno interno para uma rota pública de reserva.
 *
 * @author André Narcizo
 */
export function getPublicBookingReturnUrl(search: string): string | null {
  const value = new URLSearchParams(search).get('returnTo');
  if (!value) return null;

  try {
    const url = new URL(value, 'https://agenda-facil.local');
    if (url.origin !== 'https://agenda-facil.local' || !/^\/reservar\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname)) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Extrai o slug da reserva aprovada para vincular a sessão OTP à organização correta.
 *
 * @author André Narcizo
 */
export function getPublicBookingSlug(returnUrl: string | null): string | undefined {
  returnUrl ??= '';
  const match = returnUrl.match(/^\/reservar\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\?|$)/);
  return match?.[1];
}
