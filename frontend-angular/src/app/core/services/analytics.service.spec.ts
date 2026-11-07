import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { environment } from '../../../environments/environment';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AnalyticsService],
    });
    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('carrega o resumo e popula o signal', async () => {
    const promise = service.load();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/analytics/summary`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: {
        period: { from: '2026-12-01', to: '2026-12-31' },
        totals: { total: 3, confirmed: 1, completed: 1, cancelled: 1, pending: 0 },
        revenue_cents: 5000,
        by_day: [{ date: '2026-12-02', count: 2 }],
        top_services: [{ name: 'Corte', count: 2 }],
      },
    });
    await promise;
    expect(service.summary()?.totals.total).toBe(3);
    expect(service.summary()?.revenue_cents).toBe(5000);
  });

  it('passa from/to como query params', async () => {
    const promise = service.load('2026-12-01', '2026-12-31');
    const req = httpMock.expectOne(
      `${environment.apiBaseUrl}/analytics/summary?from=2026-12-01&to=2026-12-31`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: { period: { from: '2026-12-01', to: '2026-12-31' }, totals: { total: 0, confirmed: 0, completed: 0, cancelled: 0, pending: 0 }, revenue_cents: 0, by_day: [], top_services: [] } });
    await promise;
  });
});
