import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AgendaService } from './agenda.service';
import { environment } from '../../../environments/environment';

/**
 * Prova que o AgendaService consome os endpoints corretos e popula os signals.
 */
describe('AgendaService', () => {
  let service: AgendaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AgendaService],
    });
    service = TestBed.inject(AgendaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('carrega serviços e preenche o signal', async () => {
    const promise = service.loadServices();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/services`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 's1', name: 'Corte', category: null, duration_minutes: 60, price_cents: 5000, is_active: true }] });
    await promise;
    expect(service.services().length).toBe(1);
    expect(service.services()[0].name).toBe('Corte');
  });

  it('cria agendamento via POST /appointments', async () => {
    const promise = service.createAppointment({
      service_id: 's1',
      professional_id: 'p1',
      start_time: '2026-12-01T09:00:00.000Z',
      end_time: '2026-12-01T10:00:00.000Z',
    });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/appointments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.professional_id).toBe('p1');
    req.flush({ data: { id: 'a1', status: 'pending', start_time: '', end_time: '', service_id: 's1', professional_id: 'p1', customer_id: null, booking_source: 'direct' } });
    const result = await promise;
    expect(result.id).toBe('a1');
  });

  it('altera status via POST /appointments/{id}/status', async () => {
    const promise = service.updateStatus('a1', 'confirmed');
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/appointments/a1/status`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.status).toBe('confirmed');
    req.flush({ data: {} });
    await promise;
  });
});
