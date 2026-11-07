import type { Plan } from '../models';

/** Rótulo e classe de pílula por status de agendamento. */
export const APPOINTMENT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'pill-pend' },
  confirmed: { label: 'Confirmado', cls: 'pill-ok' },
  completed: { label: 'Concluído', cls: 'pill-info' },
  cancelled: { label: 'Cancelado', cls: 'pill-bad' },
};

/** Rótulo e classe de pílula por status de assinatura. */
export const SUBSCRIPTION_STATUS: Record<string, { label: string; cls: string }> = {
  trialing: { label: 'Teste grátis', cls: 'pill-info' },
  active: { label: 'Ativo', cls: 'pill-ok' },
  grace: { label: 'Em regularização', cls: 'pill-pend' },
  past_due: { label: 'Pagamento pendente', cls: 'pill-pend' },
  suspended: { label: 'Suspenso', cls: 'pill-bad' },
  canceled: { label: 'Cancelado', cls: 'pill-bad' },
  incomplete: { label: 'Incompleto', cls: 'pill-pend' },
};

export function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

/** Converte os entitlements do servidor em frases curtas para os cartões de plano. */
export function planFeatures(plan: Plan): string[] {
  const e = plan.entitlements;
  const out: string[] = [];

  const pros = e['professionals'];
  out.push(pros === null || pros === undefined ? 'Profissionais ilimitados' : pros === 1 ? '1 profissional' : `Até ${pros} profissionais`);

  const appts = e['monthly_appointments'];
  out.push(appts === null || appts === undefined ? 'Agendamentos ilimitados' : `Até ${appts} agendamentos/mês`);

  const msgs = e['messages'];
  out.push(msgs === null || msgs === undefined ? 'Lembretes ilimitados' : `Até ${msgs} lembretes/mês`);

  if (e['premium_reports'] === true) {
    out.push('Relatórios avançados');
  }
  return out;
}
