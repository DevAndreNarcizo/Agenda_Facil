import { Component, inject, signal } from '@angular/core';
import { Api, Plan, Subscription, currency, errorMessage } from '../core/api';
interface Invoice {
  id: string;
  status: string;
  amount_cents?: number;
  total_cents?: number;
  due_date?: string;
}
@Component({
  template: `<section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Plano e faturamento</p>
        <h1>Assinatura</h1>
        <p>Consulte seu plano e o histórico de cobranças.</p>
      </div>
    </header>
    @if (error()) {
      <p role="alert" class="notice error">{{ error() }}</p>
    }
    @if (message()) {
      <p role="status" class="notice success">{{ message() }}</p>
    }
    @if (loading()) {
      <p role="status">Carregando assinatura…</p>
    } @else {
      <section class="panel">
        <h2>Plano atual</h2>
        <p>
          <strong>{{ subscription()?.plan_name || 'Plano ainda não vinculado' }}</strong>
        </p>
        <p>
          Status:
          <strong>{{
            labels[subscription()?.status || ''] || subscription()?.status || 'Sem assinatura'
          }}</strong>
        </p>
        <p class="help">O acesso e os limites são verificados pelo servidor em cada operação.</p>
        @if (subscription()?.cancel_at_period_end) {
          <p class="notice">Cancelamento agendado para o fim do período.</p>
        }
        @if (subscription()?.status === 'active' || subscription()?.status === 'past_due') {
          <button class="danger-quiet" (click)="cancelDialog.showModal()">
            Cancelar assinatura
          </button>
        }
      </section>
      <h2>Planos disponíveis</h2>
      <div class="plans">
        @for (plan of plans(); track plan.id || plan.code) {
          <article class="panel plan">
            <h3>{{ plan.name }}</h3>
            @if (plan.synthetic) {
              <p class="help">Catálogo sintético de desenvolvimento</p>
            }
            <p class="plan-price">{{ money(plan.price_cents) }}<small>/mês</small></p>
            <button
              class="primary"
              [disabled]="
                busy() ||
                (subscription()?.plan_code === plan.code && subscription()?.status === 'active')
              "
              (click)="selectPlan(plan)"
            >
              {{
                busy()
                  ? 'Aguarde…'
                  : subscription()?.plan_code === plan.code && subscription()?.status === 'active'
                    ? 'Plano atual'
                    : subscription()?.status === 'active'
                      ? 'Mudar para ' + plan.name
                      : 'Escolher ' + plan.name
              }}
            </button>
          </article>
        } @empty {
          <p class="notice">O catálogo de planos ainda não está disponível.</p>
        }
      </div>
      <p class="help">
        Checkout e mudanças de assinatura dependem da homologação do gateway. Nenhum retorno de
        checkout confirma pagamento por si só.
      </p>
      <section class="panel">
        <h2>Histórico de cobranças</h2>
        @if (!invoices().length) {
          <p class="empty">Nenhuma cobrança registrada.</p>
        } @else {
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cobrança</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (invoice of invoices(); track invoice.id) {
                  <tr>
                    <td>{{ invoice.id }}</td>
                    <td>{{ money(invoice.amount_cents ?? invoice.total_cents ?? 0) }}</td>
                    <td>{{ invoice.status }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
    <dialog #cancelDialog class="confirm-dialog" aria-labelledby="cancel-title">
      <h2 id="cancel-title">Cancelar assinatura?</h2>
      <p>
        O acesso pago seguirá a data de término informada pelo servidor. Seus dados e o acesso à
        regularização serão preservados.
      </p>
      <div class="row-actions">
        <button autofocus (click)="cancelDialog.close()">Manter assinatura</button
        ><button class="danger" [disabled]="busy()" (click)="cancel(cancelDialog)">
          Cancelar no fim do período
        </button>
      </div>
    </dialog>
  </section>`,
})
export class BillingPage {
  private readonly api = inject(Api);
  readonly plans = signal<Plan[]>([]);
  readonly subscription = signal<Subscription | null>(null);
  readonly invoices = signal<Invoice[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly money = currency;
  private readonly checkoutKeys = new Map<string, string>();
  readonly labels: Record<string, string> = {
    trialing: 'Teste grátis',
    active: 'Ativa',
    past_due: 'Pagamento pendente',
    grace_period: 'Em regularização',
    suspended: 'Suspensa',
    cancelled: 'Cancelada',
    canceled: 'Cancelada',
    incomplete: 'Aguardando pagamento',
  };
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    try {
      const [plans, subscription, invoices] = await Promise.all([
        this.api.get<Plan[]>('/billing/plans'),
        this.api.get<Subscription | null>('/billing/subscription'),
        this.api.get<Invoice[]>('/billing/invoices'),
      ]);
      this.plans.set(plans);
      this.subscription.set(subscription);
      this.invoices.set(invoices);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  checkoutKey(code: string): string {
    const key = this.checkoutKeys.get(code) ?? crypto.randomUUID();
    this.checkoutKeys.set(code, key);
    return key;
  }
  async selectPlan(plan: Plan): Promise<void> {
    if (this.subscription()?.status !== 'active') {
      await this.checkout(plan);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post('/billing/change-plan', { plan_code: plan.code });
      this.message.set('Troca de plano solicitada. A confirmação será atualizada pelo provedor.');
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async cancel(dialog: HTMLDialogElement): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post('/billing/cancel', { at_period_end: true });
      dialog.close();
      this.message.set('Cancelamento solicitado para o fim do período.');
      await this.load();
    } catch (error) {
      dialog.close();
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async checkout(plan: Plan): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.api.post<{ url: string }>(
        '/billing/checkout',
        { plan_code: plan.code },
        { 'Idempotency-Key': this.checkoutKey(plan.code) },
      );
      const url = new URL(result.url);
      if (url.protocol !== 'https:')
        throw new Error('O provedor retornou um endereço de checkout inválido.');
      window.location.assign(url.href);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
