import { Routes } from '@angular/router';
import { organizationGuard, permissionGuard, sessionGuard } from './core/auth';
export const routes: Routes = [
  {
    path: '',
    title: 'AgendaFácil — Sua agenda, mais simples',
    loadComponent: () => import('./features/landing-page').then((m) => m.LandingPage),
  },
  {
    path: 'login',
    title: 'Entrar | AgendaFácil',
    loadComponent: () => import('./features/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    title: 'Criar conta | AgendaFácil',
    loadComponent: () => import('./features/auth-page').then((m) => m.AuthPage),
    data: { register: true },
  },
  {
    path: 'forgot-password',
    title: 'Recuperar senha | AgendaFácil',
    loadComponent: () => import('./features/password-page').then((m) => m.PasswordPage),
  },
  {
    path: 'reset-password',
    title: 'Redefinir senha | AgendaFácil',
    loadComponent: () => import('./features/password-page').then((m) => m.PasswordPage),
    data: { reset: true },
  },
  {
    path: 'convite',
    title: 'Convite para a equipe | AgendaFácil',
    loadComponent: () => import('./features/invitation-page').then((m) => m.InvitationPage),
  },
  {
    path: 'organizations',
    title: 'Suas organizações | AgendaFácil',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/organizations-page').then((m) => m.OrganizationsPage),
  },
  {
    path: 'onboarding',
    title: 'Seu negócio | AgendaFácil',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/onboarding-page').then((m) => m.OnboardingPage),
  },
  {
    path: 'portal/:slug',
    title: 'Portal do cliente | AgendaFácil',
    loadComponent: () => import('./features/portal-page').then((m) => m.PortalPage),
  },
  {
    path: 'reservar/:slug',
    title: 'Reserva online | AgendaFácil',
    loadComponent: () => import('./features/public-booking-page').then((m) => m.PublicBookingPage),
  },
  {
    path: 'dashboard',
    title: 'Painel | AgendaFácil',
    canActivate: [sessionGuard, organizationGuard],
    loadComponent: () => import('./features/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        title: 'Visão geral | AgendaFácil',
        loadComponent: () => import('./features/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'calendar',
        title: 'Agenda | AgendaFácil',
        loadComponent: () => import('./features/calendar-page').then((m) => m.CalendarPage),
      },
      {
        path: 'customers',
        title: 'Clientes | AgendaFácil',
        loadComponent: () => import('./features/resources-page').then((m) => m.ResourcesPage),
        data: { kind: 'customers' },
      },
      {
        path: 'services',
        title: 'Serviços | AgendaFácil',
        canActivate: [permissionGuard],
        loadComponent: () => import('./features/resources-page').then((m) => m.ResourcesPage),
        data: { kind: 'services', roles: ['owner', 'admin'] },
      },
      {
        path: 'professionals',
        title: 'Profissionais | AgendaFácil',
        canActivate: [permissionGuard],
        loadComponent: () => import('./features/resources-page').then((m) => m.ResourcesPage),
        data: { kind: 'professionals', roles: ['owner', 'admin'] },
      },
      { path: 'employees', redirectTo: 'professionals' },
      {
        path: 'analytics',
        title: 'Analytics | AgendaFácil',
        loadComponent: () => import('./features/analytics-page').then((m) => m.AnalyticsPage),
      },
      {
        path: 'memberships',
        title: 'Equipe e convites | AgendaFácil',
        canActivate: [permissionGuard],
        loadComponent: () => import('./features/memberships-page').then((m) => m.MembershipsPage),
        data: { roles: ['owner', 'admin'] },
      },
      {
        path: 'settings',
        title: 'Configurações | AgendaFácil',
        canActivate: [permissionGuard],
        loadComponent: () => import('./features/settings-page').then((m) => m.SettingsPage),
        data: { roles: ['owner', 'admin'] },
      },
      {
        path: 'subscription',
        title: 'Assinatura | AgendaFácil',
        canActivate: [permissionGuard],
        loadComponent: () => import('./features/billing-page').then((m) => m.BillingPage),
        data: { roles: ['owner'] },
      },
    ],
  },
  {
    path: 'acesso-negado',
    title: 'Acesso negado | AgendaFácil',
    loadComponent: () => import('./features/status-page').then((m) => m.StatusPage),
    data: {
      title: 'Acesso negado',
      description:
        'Seu perfil não tem permissão para acessar esta área. Fale com o proprietário do negócio.',
    },
  },
  {
    path: 'indisponivel',
    title: 'Serviço indisponível | AgendaFácil',
    loadComponent: () => import('./features/status-page').then((m) => m.StatusPage),
    data: {
      title: 'Serviço indisponível',
      description:
        'Não foi possível carregar sua sessão. Confira a conexão e tente entrar novamente.',
    },
  },
  {
    path: '**',
    title: 'Página não encontrada | AgendaFácil',
    loadComponent: () => import('./features/status-page').then((m) => m.StatusPage),
  },
];
