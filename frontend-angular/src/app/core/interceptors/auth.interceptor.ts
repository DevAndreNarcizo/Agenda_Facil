import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Anexa o token Sanctum (Authorization: Bearer) e o contexto de organização
 * (X-Organization-Id) às requisições à API. O servidor valida o acesso — o header
 * é apenas a organização pretendida; a autoridade é do backend.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  let headers = req.headers.set('Accept', 'application/json');

  // Endpoints públicos (/public/...) são anônimos ou autenticados por sessão opaca de portal
  // (X-Portal-Session). NUNCA anexar o token Sanctum nem o contexto de organização a eles.
  const isPublic = req.url.includes('/public/');

  if (!isPublic) {
    const token = auth.token;
    const orgId = auth.activeOrgId();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    if (orgId) {
      headers = headers.set('X-Organization-Id', orgId);
    }
  }

  return next(req.clone({ headers }));
};
