import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PublicBookingContext } from '../models';

/**
 * Fluxo de reserva pública + portal do cliente. Usa a API pública (/public/{slug}/...),
 * autenticada por SESSÃO OPACA via header X-Portal-Session (nunca o token Sanctum).
 * O token do portal é guardado por slug no localStorage.
 */
@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  private readonly _context = signal<PublicBookingContext | null>(null);
  readonly context = this._context.asReadonly();

  constructor(private readonly http: HttpClient) {}

  private base(slug: string): string {
    return `${environment.apiBaseUrl}/public/${encodeURIComponent(slug)}`;
  }

  private sessionKey(slug: string): string {
    return `agenda_facil_portal_${slug}`;
  }

  portalToken(slug: string): string | null {
    return localStorage.getItem(this.sessionKey(slug));
  }

  async loadContext(slug: string): Promise<PublicBookingContext> {
    const res = await firstValueFrom(
      this.http.get<{ data: PublicBookingContext }>(`${this.base(slug)}/context`),
    );
    this._context.set(res.data);
    return res.data;
  }

  /** Solicita OTP (resposta genérica; debug_code só em dev). */
  async requestOtp(slug: string, phone: string): Promise<{ message: string; debug_code?: string }> {
    return firstValueFrom(
      this.http.post<{ message: string; debug_code?: string }>(
        `${this.base(slug)}/portal/otp/request`,
        { phone },
      ),
    );
  }

  /** Verifica o OTP, persiste a sessão opaca e retorna o token. */
  async verifyOtp(slug: string, phone: string, code: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; expires_at: string }>(
        `${this.base(slug)}/portal/otp/verify`,
        { phone, code },
      ),
    );
    localStorage.setItem(this.sessionKey(slug), res.token);
    return res.token;
  }

  /** Cria a reserva usando a sessão de portal (header X-Portal-Session). */
  async createBooking(
    slug: string,
    input: { service_id: string; professional_id: string; start_time: string },
  ): Promise<{ id: string; status: string; start_time: string; end_time: string }> {
    const token = this.portalToken(slug);
    const headers = new HttpHeaders(token ? { 'X-Portal-Session': token } : {});
    const res = await firstValueFrom(
      this.http.post<{ data: { id: string; status: string; start_time: string; end_time: string } }>(
        `${this.base(slug)}/portal/booking`,
        input,
        { headers },
      ),
    );
    return res.data;
  }

  logout(slug: string): void {
    localStorage.removeItem(this.sessionKey(slug));
  }
}
