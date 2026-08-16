import { useCallback } from 'react';
import type { BookingSource } from '@/lib/public-booking-source';

export const PUBLIC_BOOKING_FUNNEL_EVENT = 'agenda-facil:public-booking-funnel';

const FUNNEL_STORAGE_KEY = 'agenda-facil:public-booking-funnel-events';
const MAX_STORED_FUNNEL_EVENTS = 100;

export type PublicBookingFunnelEventName =
  | 'booking_completed'
  | 'booking_started'
  | 'identity_verification_requested'
  | 'page_viewed';

export type PublicBookingFunnelEvent = {
  name: PublicBookingFunnelEventName;
  occurredAt: string;
  slug: string;
  source: BookingSource;
};

/**
 * Lê o armazenamento do navegador de forma defensiva para ambientes com privacidade restrita.
 *
 * @author André Narcizo
 */
function readStoredEvents(): PublicBookingFunnelEvent[] {
  try {
    const value = window.sessionStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!value) return [];

    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isPublicBookingFunnelEvent) : [];
  } catch {
    return [];
  }
}

/**
 * Confere o contrato mínimo dos eventos locais antes de reutilizá-los.
 *
 * @author André Narcizo
 */
function isPublicBookingFunnelEvent(value: unknown): value is PublicBookingFunnelEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<PublicBookingFunnelEvent>;
  return typeof event.name === 'string'
    && typeof event.occurredAt === 'string'
    && typeof event.slug === 'string'
    && typeof event.source === 'string';
}

/**
 * Registra um evento de funil somente no cliente e sem PII ou tokens de sessão.
 *
 * @author André Narcizo
 */
export function trackPublicBookingFunnelEvent(event: Omit<PublicBookingFunnelEvent, 'occurredAt'>): void {
  if (typeof window === 'undefined') return;

  const trackedEvent: PublicBookingFunnelEvent = {
    ...event,
    occurredAt: new Date().toISOString(),
  };

  try {
    const storedEvents = readStoredEvents();
    window.sessionStorage.setItem(
      FUNNEL_STORAGE_KEY,
      JSON.stringify([...storedEvents, trackedEvent].slice(-MAX_STORED_FUNNEL_EVENTS)),
    );
  } catch {
    // A telemetria não pode bloquear a reserva quando o storage estiver indisponível.
  }

  window.dispatchEvent(new CustomEvent<PublicBookingFunnelEvent>(PUBLIC_BOOKING_FUNNEL_EVENT, {
    detail: trackedEvent,
  }));
}

/**
 * Disponibiliza telemetria anônima do funil para a página pública de reserva.
 *
 * @author André Narcizo
 */
export function usePublicBookingFunnel(slug: string, source: BookingSource) {
  const track = useCallback((name: PublicBookingFunnelEventName): void => {
    trackPublicBookingFunnelEvent({ name, slug, source });
  }, [slug, source]);

  return { track };
}
