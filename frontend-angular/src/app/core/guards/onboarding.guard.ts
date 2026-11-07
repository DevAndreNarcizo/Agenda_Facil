import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OrganizationService } from '../services/organization.service';

/**
 * Exige que o onboarding esteja concluído para acessar a área operacional.
 * Caso contrário, redireciona ao fluxo de onboarding.
 */
export const onboardingCompletedGuard: CanActivateFn = async () => {
  const org = inject(OrganizationService);
  const router = inject(Router);

  const state = org.state() ?? (await org.load().catch(() => null));
  if (state?.onboarding_completed) {
    return true;
  }

  return router.createUrlTree(['/onboarding']);
};
