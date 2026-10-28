import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';
import { errorMessage } from '../core/api';
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `<div class="workspace">
    <aside class="sidebar">
      <a routerLink="/dashboard" class="sidebar-brand" aria-label="AgendaFácil · início"
        ><img src="/assets/logo-mark.png" width="36" height="36" alt="" /><span class="brand"
          >Agenda<span>Fácil</span></span
        ></a
      >
      <p class="org-name">{{ auth.identity()?.organization?.name }}</p>
      <nav aria-label="Navegação principal">
        @for (item of navigation; track item.path) {
          @if (!item.roles || item.roles.includes(auth.role() || '')) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
              [attr.aria-label]="item.label"
              [attr.title]="item.label"
              ><span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span
              ><span class="nav-label">{{ item.label }}</span></a
            >
          }
        }
      </nav>
      <div class="account">
        <span class="nav-label">{{ auth.identity()?.user?.name }}</span
        ><button (click)="toggleTheme()" aria-label="Alternar tema">
          <span class="material-symbols-outlined" aria-hidden="true">light_mode</span></button
        ><button (click)="logout()" aria-label="Encerrar sessão">
          <span class="material-symbols-outlined" aria-hidden="true">logout</span>
        </button>
      </div>
    </aside>
    <div class="workspace-content">
      <header class="topbar">
        <span>{{ auth.identity()?.organization?.name }}</span
        ><a class="button primary small" routerLink="/dashboard/calendar">Abrir agenda</a>
      </header>
      @if (error()) {
        <p role="alert" class="notice error">{{ error() }}</p>
      }
      <main id="conteudo" tabindex="-1"><router-outlet /></main>
    </div>
  </div>`,
})
export class Shell {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly navigation = [
    { path: '/dashboard', label: 'Início', icon: 'space_dashboard' },
    { path: '/dashboard/calendar', label: 'Agenda', icon: 'calendar_month' },
    { path: '/dashboard/customers', label: 'Clientes', icon: 'group' },
    {
      path: '/dashboard/professionals',
      label: 'Profissionais',
      icon: 'badge',
      roles: ['owner', 'admin'],
    },
    { path: '/dashboard/services', label: 'Serviços', icon: 'spa', roles: ['owner', 'admin'] },
    { path: '/dashboard/memberships', label: 'Equipe', icon: 'group', roles: ['owner', 'admin'] },
    { path: '/dashboard/analytics', label: 'Analytics', icon: 'monitoring' },
    { path: '/dashboard/subscription', label: 'Assinatura', icon: 'credit_card', roles: ['owner'] },
    {
      path: '/dashboard/settings',
      label: 'Configurações',
      icon: 'settings',
      roles: ['owner', 'admin'],
    },
    { path: '/organizations', label: 'Organizações', icon: 'space_dashboard' },
  ];
  toggleTheme(): void {
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('af-theme', dark ? 'dark' : 'light');
  }
  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
