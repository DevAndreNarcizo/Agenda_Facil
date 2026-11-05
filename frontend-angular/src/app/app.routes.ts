import { Routes } from '@angular/router';
import { authGuard, managerGuard } from './core/guards/auth.guard';

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
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'plans',
    loadComponent: () => import('./pages/plans/plans.page').then((m) => m.PlansPage),
  },
  {
    path: 'subscription',
    canActivate: [authGuard, managerGuard],
    loadComponent: () =>
      import('./pages/subscription/subscription.page').then((m) => m.SubscriptionPage),
  },

  { path: '**', redirectTo: 'login' },
];
