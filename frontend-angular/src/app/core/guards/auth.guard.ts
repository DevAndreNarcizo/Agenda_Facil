import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Exige usuário autenticado. Tenta reidratar a sessão a partir do token antes de barrar.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  if (auth.token) {
    await auth.loadMe();
    if (auth.isAuthenticated()) {
      return true;
    }
  }

  return router.createUrlTree(['/login']);
};

/**
 * Restringe rotas a gestores (owner/admin). Garante a sessão hidratada antes de checar o papel
 * (evita redirecionar por engano logo após navegação direta/reload).
 */
export const managerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated() && auth.token) {
    await auth.loadMe().catch(() => undefined);
  }

  return auth.isManager() ? true : router.createUrlTree(['/dashboard']);
};
