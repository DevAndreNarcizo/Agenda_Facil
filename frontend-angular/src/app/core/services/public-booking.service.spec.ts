import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicBookingService } from './public-booking.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * Prova o fluxo de portal: OTP -> sessão opaca -> reserva, e que endpoints públicos
 * NÃO recebem o token Sanctum nem o X-Organization-Id (apenas X-Portal-Session).
 */
describe('PublicBookingService', () => {
  let service: PublicBookingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Simula um usuário de painel autenticado para garantir que o interceptor NÃO vaza
    // o token dele para os endpoints públicos.
    localStorage.setItem('agenda_facil_token', 'dashboard-token');
    localStorage.setItem('agenda_facil_org', 'org-xyz');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
        PublicBookingService,
      ],
    });
    service = TestBed.inject(PublicBookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('carrega contexto público sem token Sanctum nem X-Organization-Id', async () => {
    const promise = service.loadContext('studio-a');
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/public/studio-a/context`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Organization-Id')).toBe(false);
    req.flush({ data: { organization: { name: 'Studio A', slug: 'studio-a' }, services: [], professionals: [] } });
    await promise;
    expect(service.context()?.organization.slug).toBe('studio-a');
  });

  it('verifica OTP e persiste a sessão opaca', async () => {
    const promise = service.verifyOtp('studio-a', '11999990000', '123456');
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/public/studio-a/portal/otp/verify`);
    req.flush({ token: 'a'.repeat(64), expires_at: '2026-12-01T00:00:00Z' });
    const token = await promise;
    expect(token).toBe('a'.repeat(64));
    expect(service.portalToken('studio-a')).toBe('a'.repeat(64));
  });

  it('cria reserva enviando X-Portal-Session (não o token Sanctum)', async () => {
    localStorage.setItem('agenda_facil_portal_studio-a', 'b'.repeat(64));

    const promise = service.createBooking('studio-a', {
      service_id: 's1',
      professional_id: 'p1',
      start_time: '2026-12-01T09:00:00.000Z',
    });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/public/studio-a/portal/booking`);
    expect(req.request.headers.get('X-Portal-Session')).toBe('b'.repeat(64));
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ data: { id: 'a1', status: 'pending', start_time: '', end_time: '' } });
    const appt = await promise;
    expect(appt.id).toBe('a1');
  });
});
