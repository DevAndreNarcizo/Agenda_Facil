import { Routes } from '@angular/router';
import { authGuard, managerGuard } from './core/guards/auth.guard';
import { onboardingCompletedGuard } from './core/guards/onboarding.guard';

/**
 * Rotas standalone com lazy loading (equivalente ao React.lazy do app atual).
 * Guards: autenticação e permissão (gestor) no servidor como autoridade; aqui é UX.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'agenda',
    canActivate: [authGuard, onboardingCompletedGuard],
    loadComponent: () => import('./pages/agenda/agenda.page').then((m) => m.AgendaPage),
  },
  {
    path: 'customers',
    canActivate: [authGuard, onboardingCompletedGuard],
    loadComponent: () => import('./pages/customers/customers.page').then((m) => m.CustomersPage),
  },
  {
    path: 'services',
    canActivate: [authGuard, onboardingCompletedGuard],
    loadComponent: () => import('./pages/services/services.page').then((m) => m.ServicesPage),
  },
  {
    path: 'professionals',
    canActivate: [authGuard, onboardingCompletedGuard],
    loadComponent: () =>
      import('./pages/professionals/professionals.page').then((m) => m.ProfessionalsPage),
  },
  {
    path: 'analytics',
    canActivate: [authGuard, onboardingCompletedGuard],
    loadComponent: () => import('./pages/analytics/analytics.page').then((m) => m.AnalyticsPage),
  },
  {
    path: 'settings',
    canActivate: [authGuard, managerGuard],
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'plans',
    loadComponent: () => import('./pages/plans/plans.page').then((m) => m.PlansPage),
  },
  {
    // Reserva pública por link (mesma rota do app React atual: /reservar/:slug).
    path: 'reservar/:slug',
    loadComponent: () =>
      import('./pages/public-booking/public-booking.page').then((m) => m.PublicBookingPage),
  },
  {
    path: 'subscription',
    canActivate: [authGuard, managerGuard],
    loadComponent: () =>
      import('./pages/subscription/subscription.page').then((m) => m.SubscriptionPage),
  },

  { path: '**', redirectTo: 'login' },
];
