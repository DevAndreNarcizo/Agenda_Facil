import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth, permissionGuard } from './auth';
import { Api } from './api';
describe('isolamento da sessão na interface', () => {
  it('consulta autoridade da API sem criar tenant por parâmetros do browser', async () => {
    const get = vi.fn().mockResolvedValue({
      user: { id: 'u', name: 'Sintético', email: 'test@example.test' },
      organization: null,
      membership: null,
      subscription: null,
    });
    TestBed.configureTestingModule({ providers: [Auth, { provide: Api, useValue: { get } }] });
    const auth = TestBed.inject(Auth);
    await auth.ensure();
    expect(get).toHaveBeenCalledWith('/auth/user');
    expect(auth.identity()?.organization).toBeNull();
  });
  it('nega área administrativa a employee', () => {
    const parseUrl = vi.fn().mockReturnValue('/acesso-negado');
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { role: () => 'employee' } },
        { provide: Router, useValue: { parseUrl } },
      ],
    });
    const route = { data: { roles: ['owner', 'admin'] } };
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route as never, {} as never),
    );
    expect(result).toBe('/acesso-negado');
  });
  it('uma resposta atrasada não restaura identidade após logout', async () => {
    let resolveIdentity: (value: unknown) => void = () => undefined;
    const get = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => (resolveIdentity = resolve)));
    const post = vi.fn().mockResolvedValue(null);
    TestBed.configureTestingModule({
      providers: [Auth, { provide: Api, useValue: { get, post } }],
    });
    const auth = TestBed.inject(Auth);
    const refresh = auth.refresh();
    await auth.logout();
    resolveIdentity({
      user: { id: 'old', name: 'Anterior', email: 'old@example.test' },
      organization: null,
      membership: null,
      subscription: null,
    });
    await refresh;
    expect(auth.identity()).toBeNull();
    expect(auth.ready()).toBe(true);
  });
  it('repete leitura após falha500 sem tratar o erro como visitante', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce({
        user: { id: 'u', name: 'Sintético', email: 'test@example.test' },
        organization: null,
        membership: null,
        subscription: null,
      });
    TestBed.configureTestingModule({ providers: [Auth, { provide: Api, useValue: { get } }] });
    const auth = TestBed.inject(Auth);
    await expect(auth.ensure()).rejects.toEqual({ status: 500 });
    expect(auth.ready()).toBe(false);
    await auth.ensure();
    expect(get).toHaveBeenCalledTimes(2);
    expect(auth.identity()?.user.id).toBe('u');
  });
});
