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
  const token = auth.token;
  const orgId = auth.activeOrgId();

  let headers = req.headers;
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  if (orgId) {
    headers = headers.set('X-Organization-Id', orgId);
  }
  headers = headers.set('Accept', 'application/json');

  return next(req.clone({ headers }));
};
