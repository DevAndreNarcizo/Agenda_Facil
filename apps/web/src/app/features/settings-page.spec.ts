import { TestBed } from '@angular/core/testing';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { SettingsPage } from './settings-page';

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,synthetic'),
}));

describe('expediente do negócio', () => {
  it('preserva os sete dias recebidos e recusa fechamento anterior à abertura', async () => {
    const organization = {
      id: 'org',
      name: 'Negócio sintético',
      slug: 'synthetic',
      timezone: 'America/Manaus',
      primary_color: '#087bf5',
    };
    const business_hours = Array.from({ length: 7 }, (_, day_of_week) => ({
      day_of_week,
      start_time: '08:30:00',
      end_time: '17:30:00',
      is_active: day_of_week > 0 && day_of_week < 6,
    }));
    const patch = vi.fn().mockResolvedValue(null);
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        {
          provide: Api,
          useValue: { get: vi.fn().mockResolvedValue({ ...organization, business_hours }), patch },
        },
        { provide: Auth, useValue: { identity: () => ({ organization }) } },
      ],
    });
    const fixture = TestBed.createComponent(SettingsPage);
    const page = fixture.componentInstance;
    await page.load();
    fixture.detectChanges();
    expect(page.hours.length).toBe(7);
    expect(page.hours.at(1).controls.start_time.value).toBe('08:30');
    expect(page.form.controls.timezone.value).toBe('America/Manaus');
    page.hours.at(1).controls.end_time.setValue('07:00');
    await page.saveHours();
    expect(patch).not.toHaveBeenCalled();
    expect(page.error()).toContain('fechamento');
    const invalidEnd = fixture.nativeElement.querySelector('#business-end-1') as HTMLInputElement;
    expect(document.activeElement).toBe(invalidEnd);
    expect(invalidEnd.getAttribute('aria-invalid')).toBe('true');
    expect(invalidEnd.getAttribute('aria-describedby')).toBe('business-interval-error-1');
    page.hours.at(1).controls.end_time.setValue('18:00');
    await page.saveHours();
    expect(patch).toHaveBeenCalledWith(
      '/settings',
      expect.objectContaining({
        business_hours: expect.arrayContaining([
          expect.objectContaining({ day_of_week: 1, start_time: '08:30', end_time: '18:00' }),
        ]),
      }),
    );
  });
});
