import { Injectable, inject, signal, computed } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpInterceptorFn } from '@angular/common/http';
import { Api, Identity } from './api';
import { catchError, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly api = inject(Api);
  readonly identity = signal<Identity | null>(null);
  readonly ready = signal(false);
  readonly role = computed(() => this.identity()?.membership?.role);
  private pending: Promise<void> | null = null;
  private mutation: Promise<void> | null = null;
  private generation = 0;

  /** Compartilha a leitura vigente; falhas transitórias permitem nova tentativa. @author André Narcizo */
  ensure(): Promise<void> {
    if (this.mutation) return this.mutation;
    if (this.ready()) return Promise.resolve();
    if (this.pending) return this.pending;
    const pending = this.refresh().finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }

  async refresh(): Promise<void> {
    if (this.mutation) await this.mutation;
    const generation = ++this.generation;
    this.ready.set(false);
    await this.loadIdentity(generation);
  }

  /** Descarta respostas de leituras anteriores a login, logout ou refresh mais recente. @author André Narcizo */
  private async loadIdentity(generation: number): Promise<void> {
    try {
      const identity = await this.api.get<Identity>('/auth/user');
      if (generation !== this.generation) return;
      this.identity.set(identity);
      this.ready.set(true);
    } catch (error) {
      if (generation !== this.generation) return;
      this.identity.set(null);
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        this.ready.set(true);
        return;
      }
      this.ready.set(false);
      throw error;
    }
  }

  private changeSession(action: () => Promise<unknown>, hydrate: boolean): Promise<void> {
    const generation = ++this.generation;
    this.identity.set(null);
    this.ready.set(false);
    this.pending = null;
    const mutation = this.completeSessionChange(action, hydrate, generation).finally(() => {
      if (this.mutation === mutation) this.mutation = null;
    });
    this.mutation = mutation;
    return mutation;
  }

  private async completeSessionChange(
    action: () => Promise<unknown>,
    hydrate: boolean,
    generation: number,
  ): Promise<void> {
    try {
      await action();
      if (generation !== this.generation) return;
      if (hydrate) await this.loadIdentity(generation);
      else this.ready.set(true);
    } catch (error) {
      if (generation !== this.generation) return;
      this.ready.set(false);
      throw error;
    }
  }

  login(body: { email: string; password: string; remember: boolean }): Promise<void> {
    return this.changeSession(async () => {
      await this.api.csrf();
      await this.api.post('/auth/login', body);
    }, true);
  }

  register(body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<void> {
    return this.changeSession(async () => {
      await this.api.csrf();
      await this.api.post('/auth/register', body);
    }, true);
  }

  logout(): Promise<void> {
    return this.changeSession(() => this.api.post('/auth/logout'), false);
  }
}

export const sessionGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  try {
    await auth.ensure();
  } catch {
    return router.parseUrl('/indisponivel');
  }
  return auth.identity() ? true : router.parseUrl('/login');
};
export const organizationGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  try {
    await auth.ensure();
  } catch {
    return router.parseUrl('/indisponivel');
  }
  return auth.identity()?.organization ? true : router.parseUrl('/onboarding');
};
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const roles = route.data['roles'] as string[] | undefined;
  return !roles || roles.includes(auth.role() ?? '') ? true : router.parseUrl('/acesso-negado');
};
/** O cookie de sessão HttpOnly e o XSRF padrão do Angular são enviados same-origin. @author André Narcizo */
export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  return next(
    request.clone({
      withCredentials: true,
      setHeaders: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    }),
  ).pipe(
    catchError((error) => {
      if (
        error.status === 401 &&
        request.url.startsWith('/api/v1/') &&
        !request.url.includes('/auth/') &&
        !request.url.includes('/public/')
      ) {
        auth.identity.set(null);
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
