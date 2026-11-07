import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

/**
 * Prova que o interceptor anexa token Sanctum e contexto de organização às requisições.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('agenda_facil_token', 'tok-123');
    localStorage.setItem('agenda_facil_org', 'org-abc');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('anexa Authorization Bearer, X-Organization-Id e Accept', () => {
    http.get('/api/v1/plans').subscribe();

    const req = httpMock.expectOne('/api/v1/plans');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    expect(req.request.headers.get('X-Organization-Id')).toBe('org-abc');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({ data: [] });
  });
});
