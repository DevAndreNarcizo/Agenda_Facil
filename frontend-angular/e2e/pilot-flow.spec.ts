import { expect, test } from '@playwright/test';

/**
 * Fluxo de piloto ponta a ponta (Angular <-> API Laravel):
 * 1) cadastro -> onboarding -> agenda (cria agendamento)
 * 2) reserva pública pelo link do portal (OTP -> sessão opaca -> reserva)
 *
 * Usa dados do DemoSeeder (org studio-demo) para a reserva pública.
 */

function uniqueSlug(): string {
  return 'e2e-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

test('proprietário cadastra, conclui onboarding e cria agendamento', async ({ page }) => {
  const slug = uniqueSlug();
  const email = `${slug}@example.com`;

  // Cadastro
  await page.goto('/register');
  await page.getByLabel('Seu nome').fill('Proprietária E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha12345');
  await page.getByLabel('Nome do negócio').fill('Negócio E2E');
  await page.getByLabel('Link (slug)').fill(slug);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // Após o cadastro, chega ao painel autenticado.
  await expect(page).toHaveURL(/\/dashboard$/);

  // Sem onboarding concluído, a agenda redireciona para /onboarding (guard).
  await page.goto('/agenda');
  await expect(page).toHaveURL(/\/onboarding$/);

  // Onboarding
  await page.getByLabel('Nome do negócio').fill('Negócio E2E');
  await page.getByLabel('Nome do serviço').fill('Corte E2E');
  await page.getByLabel('Duração (min)').fill('60');
  await page.getByRole('button', { name: 'Concluir configuração' }).click();

  // Redireciona para a agenda
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();

  // Precisa de um profissional para agendar — cadastra via UI.
  await page.goto('/professionals');
  await page.getByPlaceholder('Nome do profissional').fill('Profa. E2E');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Profa. E2E')).toBeVisible();

  // Cria um agendamento na agenda. Seleciona a primeira opção real (índice 1, após o placeholder).
  await page.goto('/agenda');
  await expect(page.locator('select[formcontrolname="service_id"] option')).toHaveCount(2); // placeholder + 1 serviço
  await page.locator('select[formcontrolname="service_id"]').selectOption({ index: 1 });
  await page.locator('select[formcontrolname="professional_id"]').selectOption({ index: 1 });
  // Amanhã 10:00 no formato datetime-local.
  const tomorrow = new Date(Date.now() + 86_400_000);
  const dt = `${tomorrow.toISOString().slice(0, 10)}T10:00`;
  await page.locator('input[formcontrolname="start_time"]').fill(dt);
  await page.getByRole('button', { name: 'Agendar' }).click();

  await expect(page.getByText('Agendamento criado.')).toBeVisible();
});

test('link público inexistente mostra estado indisponível', async ({ page }) => {
  await page.goto('/reservar/organizacao-inexistente');
  await expect(page.getByRole('heading', { name: 'Reservas indisponíveis' })).toBeVisible();
});

test('cliente externo reserva pelo link público (studio-demo, OTP)', async ({ page }) => {
  // Org de demonstração com reserva pública habilitada e cliente de telefone conhecido.
  await page.goto('/reservar/studio-demo');
  await expect(page.getByRole('heading', { name: /Agendar em/ })).toBeVisible();

  // Escolhe serviço, profissional e horário (amanhã 16:00 para não colidir com seeds).
  await page.locator('select[formcontrolname="service_id"]').selectOption({ index: 1 });
  await page.locator('select[formcontrolname="professional_id"]').selectOption({ index: 1 });
  const tomorrow = new Date(Date.now() + 86_400_000);
  const dt = `${tomorrow.toISOString().slice(0, 10)}T16:00`;
  await page.locator('input[formcontrolname="start_time"]').fill(dt);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Etapa de OTP: informa telefone conhecido e solicita código.
  await page.getByLabel('Telefone (com DDD)').fill('11988887777');
  await page.getByRole('button', { name: 'Enviar código' }).click();

  // Em ambiente local/test o código vem como dica "Código (dev): NNNNNN".
  const hint = page.locator('.message');
  await expect(hint).toContainText('Código (dev):');
  const hintText = (await hint.textContent()) ?? '';
  const code = hintText.replace(/\D/g, '').slice(-6);
  expect(code).toHaveLength(6);

  await page.getByLabel('Código (6 dígitos)').fill(code);
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  await expect(page.getByRole('heading', { name: /Reserva confirmada/ })).toBeVisible();
});
