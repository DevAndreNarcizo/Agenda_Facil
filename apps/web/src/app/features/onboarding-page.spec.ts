import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Api, Organization } from '../core/api';
import { Auth } from '../core/auth';
import { OnboardingPage } from './onboarding-page';

describe('onboarding transacional em seis etapas', () => {
  const organization: Organization = {
    id: 'synthetic-organization',
    name: 'Negócio sintético',
    slug: 'negocio-sintetico',
    timezone: 'America/Sao_Paulo',
    primary_color: '#087bf5',
  };
  function setup() {
    const post = vi.fn().mockResolvedValue(organization);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [OnboardingPage],
      providers: [
        { provide: Api, useValue: { post } },
        { provide: Auth, useValue: { refresh } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    const fixture = TestBed.createComponent(OnboardingPage);
    fixture.detectChanges();
    return { page: fixture.componentInstance, fixture, post, refresh, navigateByUrl };
  }
  function fill(page: OnboardingPage): void {
    page.form.patchValue({
      name: 'Negócio sintético',
      slug: 'negocio-sintetico',
      profile: {
        specialty: 'Especialidade sintética',
        instagram: '@synthetic',
        bio: 'Descrição sintética.',
      },
      address: {
        postal_code: '74000-000',
        street: 'Rua sintética',
        number: '10',
        city: 'Cidade sintética',
        state: 'GO',
      },
      initial_service: {
        name: 'Serviço inicial sintético',
        duration_minutes: 45,
        price: 35.99,
        category: 'Inicial',
      },
    });
  }
  async function advanceToHours(page: OnboardingPage): Promise<void> {
    for (let index = 0; index < 4; index++) await page.submit();
  }
  it('usa domingo como dia zero e preserva os horários iniciais do legado', () => {
    const { page } = setup();
    expect(page.hours.getRawValue()).toEqual(
      Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        start_time: '08:00',
        end_time: day_of_week === 0 || day_of_week === 6 ? '13:00' : '18:00',
        is_active: day_of_week > 0 && day_of_week < 6,
      })),
    );
  });
  it('valida a etapa atual, mantém os dados ao voltar e não grava antes dos horários', async () => {
    const { page, post } = setup();
    await page.submit();
    expect(page.step()).toBe(0);
    expect(page.form.controls.name.touched).toBe(true);
    fill(page);
    await advanceToHours(page);
    expect(page.step()).toBe(4);
    expect(post).not.toHaveBeenCalled();
    page.back();
    expect(page.form.controls.initial_service.controls.price.value).toBe(35.99);
    page.back();
    expect(page.form.controls.address.controls.street.value).toBe('Rua sintética');
    expect(post).not.toHaveBeenCalled();
  });
  it('não aceita preço com fração de centavo, duração fora do limite ou horário invertido', async () => {
    const { page, post } = setup();
    fill(page);
    for (let index = 0; index < 3; index++) await page.submit();
    page.form.controls.initial_service.patchValue({ price: 0.001, duration_minutes: 4 });
    await page.submit();
    expect(page.step()).toBe(3);
    page.form.controls.initial_service.patchValue({ price: 35, duration_minutes: 30 });
    await page.submit();
    page.hours.at(1).controls.end_time.setValue('07:00');
    await page.submit();
    expect(page.step()).toBe(4);
    expect(page.error()).toContain('fechamento');
    expect(post).not.toHaveBeenCalled();
  });
  it('mostra sucesso somente depois da resposta e navega apenas pela ação final', async () => {
    const { page, fixture, post, refresh, navigateByUrl } = setup();
    fill(page);
    await advanceToHours(page);
    let resolve: (value: Organization) => void = () => undefined;
    post.mockImplementationOnce(() => new Promise<Organization>((done) => (resolve = done)));
    const first = page.submit();
    await page.submit();
    expect(page.step()).toBe(4);
    expect(post).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).not.toHaveBeenCalled();
    resolve(organization);
    await first;
    fixture.detectChanges();
    expect(page.step()).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Tudo pronto!');
    expect(page.publicLink()).toContain('/reservar/negocio-sintetico');
    expect(navigateByUrl).not.toHaveBeenCalled();
    const payload = post.mock.calls[0]![1];
    expect(payload.initial_service).toEqual({
      name: 'Serviço inicial sintético',
      duration_minutes: 45,
      price_cents: 3599,
      category: 'Inicial',
    });
    expect(payload).not.toHaveProperty('organization_id');
    expect(payload).not.toHaveProperty('role');
    expect(payload.business_hours).toHaveLength(7);
    await page.enterDashboard();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
  it('preserva a solicitação em uma falha e não recria a organização após receber sucesso', async () => {
    const { page, post, refresh } = setup();
    fill(page);
    await advanceToHours(page);
    post.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 503, error: { message: 'Indisponível temporariamente.' } }),
    );
    await page.submit();
    expect(page.step()).toBe(4);
    expect(page.created()).toBeNull();
    expect(page.form.controls.initial_service.controls.name.value).toBe(
      'Serviço inicial sintético',
    );
    refresh.mockRejectedValueOnce(new Error('Falha transitória da sessão'));
    await page.submit();
    expect(page.step()).toBe(5);
    expect(page.created()?.id).toBe(organization.id);
    expect(page.error()).toContain('Sua agenda foi criada');
    await page.submit();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]![1]).toEqual(post.mock.calls[1]![1]);
  });
  it('não declara sucesso quando a API não confirma a organização criada', async () => {
    const { page, post, navigateByUrl } = setup();
    fill(page);
    await advanceToHours(page);
    post.mockResolvedValueOnce(null);
    await page.submit();
    expect(page.step()).toBe(4);
    expect(page.created()).toBeNull();
    expect(page.error()).toContain('não confirmou');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
