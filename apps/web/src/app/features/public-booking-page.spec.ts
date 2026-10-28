import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Api } from '../core/api';
import { PublicBookingPage } from './public-booking-page';

describe('contexto da reserva pública', () => {
  it('descarta resposta anterior e limpa o formulário ao navegar para outro negócio', async () => {
    const params = new BehaviorSubject(convertToParamMap({ slug: 'alpha' }));
    const responses = new Map<string, (value: unknown) => void>();
    const get = vi.fn((path: string) => new Promise((resolve) => responses.set(path, resolve)));
    TestBed.configureTestingModule({
      providers: [
        { provide: Api, useValue: { get } },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new PublicBookingPage());
    page.form.controls.name.setValue('Cliente de Alpha');
    params.next(convertToParamMap({ slug: 'beta' }));
    expect(page.form.controls.name.value).toBe('');
    const context = (slug: string) => ({
      organization: { name: slug, slug, timezone: 'America/Sao_Paulo', primary_color: '#087bf5' },
      services: [],
      professionals: [],
    });
    responses.get('/public/beta')!(context('beta'));
    await Promise.resolve();
    responses.get('/public/alpha')!(context('alpha'));
    await Promise.resolve();
    expect(page.context()?.organization.slug).toBe('beta');
    expect(page.slug).toBe('beta');
  });
});
