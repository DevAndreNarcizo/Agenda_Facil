import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BillingService } from '../services/billing.service';
import { OrganizationService } from '../services/organization.service';
import { IconComponent } from './icon.component';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  manager?: boolean;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { name: 'Início', href: '/dashboard', icon: 'space_dashboard', mobile: true },
  { name: 'Agenda', href: '/agenda', icon: 'calendar_month', mobile: true },
  { name: 'Clientes', href: '/customers', icon: 'group', mobile: true },
  { name: 'Profissionais', href: '/professionals', icon: 'badge' },
  { name: 'Serviços', href: '/services', icon: 'spa', mobile: true },
  { name: 'Analytics', href: '/analytics', icon: 'monitoring', mobile: true },
  { name: 'Assinatura', href: '/subscription', icon: 'credit_card', manager: true },
  { name: 'Configurações', href: '/settings', icon: 'settings', manager: true },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietária(o)',
  admin: 'Administrador',
  employee: 'Profissional',
};

const THEME_KEY = 'agenda_facil_theme';

/**
 * Casca do painel: sidebar 232px (>=1100), rail de ícones 64px (720–1099) e barra inferior
 * no celular (<720), com cabeçalho fixo de 56px. Equivalente ao DashboardLayout do React.
 */
@Component({
  selector: 'af-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell">
      <aside class="shell-side">
        <div class="shell-brand">
          <img src="/logo-mark.png" alt="AgendaFácil" />
          <div class="brand-text">
            <span class="brand">Agenda<b>Fácil</b></span>
            <span class="org">{{ org.state()?.name ?? ' ' }}</span>
          </div>
        </div>

        <nav class="shell-nav" aria-label="Navegação principal">
          @for (item of nav(); track item.href) {
            <a [routerLink]="item.href" routerLinkActive="active" [title]="item.name">
              <af-icon [name]="item.icon" [size]="19" />
              <span class="label">{{ item.name }}</span>
            </a>
          }
        </nav>

        @if (isOwner() && billing.subscription(); as sub) {
          <div class="shell-plan">
            <span>Plano {{ sub.plan?.name ?? '—' }}{{ sub.status === 'trialing' ? ' · teste grátis' : sub.status === 'active' ? ' · ativo' : '' }}</span>
            <a routerLink="/subscription">Gerenciar assinatura</a>
          </div>
        }

        <div class="shell-user">
          <span class="avatar">{{ initials() }}</span>
          <span class="who">
            <b>{{ auth.user()?.name ?? 'Usuário' }}</b>
            <span>{{ roleLabel() }}</span>
          </span>
          <button type="button" class="btn-ghost btn-sm" (click)="signOut()" title="Encerrar sessão" aria-label="Encerrar sessão">
            <af-icon name="logout" [size]="18" />
          </button>
        </div>
      </aside>

      <div class="shell-col">
        <header class="shell-top">
          <img src="/logo-mark.png" alt="AgendaFácil" />
          <span class="where">{{ pageName() }}</span>
          <div class="spacer"></div>
          <button type="button" class="btn-icon" (click)="toggleTheme()" aria-label="Alternar tema">
            <af-icon [name]="dark() ? 'light_mode' : 'dark_mode'" />
          </button>
          <a class="btn btn-primary" routerLink="/agenda" aria-label="Novo agendamento">
            <af-icon name="add" [size]="17" /><span class="new-label">Novo agendamento</span>
          </a>
        </header>

        <main class="shell-main"><router-outlet /></main>

        <nav class="shell-bottom" aria-label="Navegação inferior">
          @for (item of mobileNav(); track item.href) {
            <a [routerLink]="item.href" routerLinkActive="active">
              <af-icon [name]="item.icon" [size]="22" />
              <span>{{ item.name }}</span>
            </a>
          }
        </nav>
      </div>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly org = inject(OrganizationService);
  readonly billing = inject(BillingService);
  private readonly router = inject(Router);

  readonly dark = signal(false);
  readonly url = signal(this.router.url);

  readonly nav = computed(() => NAV.filter((i) => !i.manager || this.auth.isManager()));
  readonly mobileNav = computed(() => this.nav().filter((i) => i.mobile).slice(0, 5));
  readonly isOwner = computed(() => this.auth.activeMembership()?.role === 'owner');
  readonly roleLabel = computed(() => ROLE_LABELS[this.auth.activeMembership()?.role ?? ''] ?? 'Equipe');
  readonly initials = computed(() => {
    const parts = (this.auth.user()?.name ?? '?').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
  });
  readonly pageName = computed(() => {
    const url = this.url();
    return NAV.find((i) => url.startsWith(i.href))?.name ?? 'Início';
  });

  constructor() {
    this.router.events.subscribe(() => this.url.set(this.router.url));
  }

  async ngOnInit(): Promise<void> {
    const saved = localStorage.getItem(THEME_KEY);
    this.dark.set(saved === 'dark');
    document.documentElement.classList.toggle('dark', this.dark());

    // Dados do cabeçalho/menu: não fatais (as páginas tratam seus próprios erros).
    if (!this.org.state()) {
      await this.org.load().catch(() => undefined);
    }
    this.org.applyBrandColor();
    if (this.isOwner()) {
      await this.billing.loadSubscription().catch(() => undefined);
    }
  }

  toggleTheme(): void {
    const next = !this.dark();
    this.dark.set(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }

  async signOut(): Promise<void> {
    await this.auth.logout().catch(() => undefined);
    await this.router.navigate(['/login']);
  }
}
