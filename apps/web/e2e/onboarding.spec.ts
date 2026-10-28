import { expect, test } from '@playwright/test';

test('wizard preserva dados ao voltar e persiste perfil, endereço, serviço e expediente em uma transação', async ({
  page,
}) => {
  const suffix = Date.now().toString();
  const slug = `onboarding-${suffix}`;
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/onboarding' && request.method() === 'POST')
      requests++;
  });
  await page.goto('/register');
  await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa Sintética Wizard');
  await page.getByLabel('E-mail', { exact: true }).fill(`onboarding-${suffix}@example.test`);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSintetica123!');
  await page.getByLabel('Confirme sua senha', { exact: true }).fill('SenhaSintetica123!');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/onboarding$/);
  await page.getByLabel('Nome do negócio', { exact: true }).fill('Studio Sintético Wizard');
  await page.getByLabel('Link de reserva', { exact: true }).fill(slug);
  await page.getByLabel('Fuso horário', { exact: true }).selectOption('America/Manaus');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'Etapa 1 de 6: Boas-vindas',
  );
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Perfil profissional' })).toBeFocused();
  await page
    .getByLabel('Especialidade principal (opcional)', { exact: true })
    .fill('Especialidade sintética');
  await page
    .getByLabel('Instagram profissional (opcional)', { exact: true })
    .fill('@synthetic_wizard');
  await page
    .getByLabel('Biografia curta (opcional)', { exact: true })
    .fill('Biografia sintética para validação local.');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('CEP (opcional)', { exact: true }).fill('69000-000');
  await page
    .getByLabel('Rua ou avenida (opcional)', { exact: true })
    .fill('Rua sintética de teste');
  await page.getByLabel('Número (opcional)', { exact: true }).fill('10');
  await page.getByLabel('Cidade (opcional)', { exact: true }).fill('Manaus');
  await page.getByLabel('Estado (opcional)', { exact: true }).selectOption('AM');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByLabel('Instagram profissional (opcional)', { exact: true })).toHaveValue(
    '@synthetic_wizard',
  );
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Rua ou avenida (opcional)', { exact: true })).toHaveValue(
    'Rua sintética de teste',
  );
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page
    .getByLabel('Nome do serviço inicial', { exact: true })
    .fill('Serviço sintético inicial');
  await page.getByLabel('Preço em reais', { exact: true }).fill('35.99');
  await page.getByLabel('Duração em minutos', { exact: true }).fill('45');
  await page.getByLabel('Categoria (opcional)', { exact: true }).fill('Inicial');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Horários de funcionamento' })).toBeFocused();
  const monday = page.getByRole('group', { name: 'Segunda-feira', exact: true });
  await monday.getByLabel('Abertura', { exact: true }).fill('08:30');
  await monday.getByLabel('Fechamento', { exact: true }).fill('17:30');
  expect(requests).toBe(0);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/onboarding' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Finalizar e criar agenda', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Tudo pronto!' })).toBeVisible();
  await expect(page).toHaveURL(/onboarding$/);
  await expect(page.getByRole('link', { name: new RegExp(`/reservar/${slug}$`) })).toBeVisible();
  expect(requests).toBe(1);
  const settingsResponse = await page.request.get('/api/v1/settings', {
    headers: { Accept: 'application/json' },
  });
  expect(settingsResponse.status()).toBe(200);
  const settings = (await settingsResponse.json()).data;
  expect(settings.timezone).toBe('America/Manaus');
  expect(settings.settings.specialty).toBe('Especialidade sintética');
  expect(settings.settings.instagram).toBe('@synthetic_wizard');
  expect(settings.settings.bio).toBe('Biografia sintética para validação local.');
  expect(settings.settings.address).toEqual({
    postal_code: '69000-000',
    street: 'Rua sintética de teste',
    number: '10',
    city: 'Manaus',
    state: 'AM',
  });
  expect(settings.business_hours).toHaveLength(7);
  expect(
    settings.business_hours.find((day: { day_of_week: number }) => day.day_of_week === 1),
  ).toMatchObject({ start_time: '08:30:00', end_time: '17:30:00', is_active: true });
  expect(
    settings.business_hours.find((day: { day_of_week: number }) => day.day_of_week === 0),
  ).toMatchObject({ is_active: false });
  const servicesResponse = await page.request.get('/api/v1/services', {
    headers: { Accept: 'application/json' },
  });
  const services = (await servicesResponse.json()).data;
  expect(services).toHaveLength(1);
  expect(services[0]).toMatchObject({
    name: 'Serviço sintético inicial',
    duration_minutes: 45,
    price_cents: 3599,
    category: 'Inicial',
  });
  await page.getByRole('button', { name: 'Entrar no painel', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
});
