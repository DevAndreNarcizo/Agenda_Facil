import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Normaliza erros HTTP para a UI e reage a estados de autenticação/assinatura:
 *  - 401: encerra a sessão e leva ao login.
 *  - 402: assinatura inativa (a UI deve direcionar à regularização).
 *  - 409/422: conflito/validação repassados para tratamento local.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const isPublic = req.url.includes('/public/');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 em endpoint público = sessão de portal inválida; não derruba a sessão do painel.
      if (error.status === 401 && !isPublic) {
        void auth.logout().finally(() => router.navigate(['/login']));
      }
      return throwError(() => error);
    }),
  );
};
