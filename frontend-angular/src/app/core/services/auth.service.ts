import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthUser, Membership } from '../models';

interface AuthResponse {
  user: AuthUser;
  token: string;
}

const TOKEN_KEY = 'agenda_facil_token';
const ORG_KEY = 'agenda_facil_org';

/**
 * Estado de autenticação da SPA via signals (equivalente ao AuthContext do React).
 * Guarda o token Sanctum e a organização ativa; expõe sinais derivados para guards/UI.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _memberships = signal<Membership[]>([]);
  private readonly _activeOrgId = signal<string | null>(localStorage.getItem(ORG_KEY));
  private readonly _loading = signal<boolean>(false);

  readonly user = this._user.asReadonly();
  readonly memberships = this._memberships.asReadonly();
  readonly activeOrgId = this._activeOrgId.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly activeMembership = computed(
    () => this._memberships().find((m) => m.organization_id === this._activeOrgId()) ?? null,
  );
  readonly isManager = computed(() => {
    const role = this.activeMembership()?.role;
    return role === 'owner' || role === 'admin';
  });

  constructor(private readonly http: HttpClient) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async register(payload: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
    org_name: string;
    org_slug: string;
    segment?: string;
  }): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, payload),
    );
    this.persistToken(res.token);
    await this.loadMe();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password }),
    );
    this.persistToken(res.token);
    await this.loadMe();
  }

  /** Carrega o usuário autenticado e seus vínculos; define a organização ativa. */
  async loadMe(): Promise<void> {
    if (!this.token) {
      return;
    }
    this._loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ user: AuthUser; memberships: Membership[] }>(
          `${environment.apiBaseUrl}/auth/me`,
        ),
      );
      this._user.set(res.user);
      this._memberships.set(res.memberships);
      if (!this._activeOrgId() && res.memberships.length > 0) {
        this.setActiveOrg(res.memberships[0].organization_id);
      }
    } finally {
      this._loading.set(false);
    }
  }

  setActiveOrg(orgId: string): void {
    this._activeOrgId.set(orgId);
    localStorage.setItem(ORG_KEY, orgId);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}));
    } finally {
      this.clear();
    }
  }

  private persistToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_KEY);
    this._user.set(null);
    this._memberships.set([]);
    this._activeOrgId.set(null);
  }
}
