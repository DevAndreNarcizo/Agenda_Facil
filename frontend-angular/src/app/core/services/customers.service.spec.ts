import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CustomersService } from './customers.service';
import { environment } from '../../../environments/environment';

describe('CustomersService', () => {
  let service: CustomersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CustomersService],
    });
    service = TestBed.inject(CustomersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('busca clientes com query param codificada', async () => {
    const promise = service.load('maria silva');
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/customers?q=maria%20silva`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 'c1', name: 'Maria Silva', phone: null, email: null, notes: null }] });
    await promise;
    expect(service.customers()[0].name).toBe('Maria Silva');
  });

  it('cria cliente (POST) e em seguida recarrega a lista (GET)', async () => {
    const promise = service.create({ name: 'João' });

    // Primeira requisição: POST de criação.
    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiBaseUrl}/customers`,
    );
    post.flush({ data: { id: 'c2', name: 'João', phone: null, email: null, notes: null } });

    // await microtask para o create() encadear o load().
    await Promise.resolve();

    // Segunda requisição: GET de recarga disparado por create().
    const reload = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === `${environment.apiBaseUrl}/customers`,
    );
    reload.flush({ data: [{ id: 'c2', name: 'João', phone: null, email: null, notes: null }] });

    await promise;
    expect(service.customers().length).toBe(1);
  });
});
