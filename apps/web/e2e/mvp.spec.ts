import { expect, test, type Page } from '@playwright/test';

/** Verifica borda, preenchimento e superfície adjacente realmente renderizados. @author André Narcizo */
async function assertControlBorderContrast(page: Page, selector: string): Promise<void> {
  const colors = await page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    let parent = element.parentElement;
    let outside = getComputedStyle(document.documentElement).backgroundColor;
    while (parent) {
      const background = getComputedStyle(parent).backgroundColor;
      const channels = background.match(/[\d.]+/g)?.map(Number) ?? [];
      if (channels.length < 4 || channels[3] !== 0) {
        outside = background;
        break;
      }
      parent = parent.parentElement;
    }
    return { border: style.borderTopColor, inside: style.backgroundColor, outside };
  });
  const luminance = (color: string): number => {
    const rgb = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((part) => Number(part) / 255);
    return rgb.reduce(
      (total, value, index) =>
        total +
        (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
          [0.2126, 0.7152, 0.0722][index]!,
      0,
    );
  };
  for (const adjacent of [colors.inside, colors.outside]) {
    const values = [luminance(colors.border), luminance(adjacent)].sort((a, b) => b - a);
    expect((values[0]! + 0.05) / (values[1]! + 0.05)).toBeGreaterThanOrEqual(3);
  }
}

test('landing e acesso se adaptam sem overflow em smartphone, tablet e desktop', async ({
  page,
}) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mais tempo');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.goto('/login');
    await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Entrar | AgendaFácil');
    await page.getByRole('link', { name: 'Pular para o conteúdo' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#conteudo')).toBeFocused();
    await assertControlBorderContrast(page, '#email');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await assertControlBorderContrast(page, '#email');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test('ciclo real: cadastro, reserva, agenda, cobrança indisponível e portal local', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const suffix = Date.now().toString();
  const email = `e2e-${suffix}@example.test`;
  const password = 'SenhaSintetica123!';
  const slug = `studio-${suffix}`;
  await page.goto('/register');
  await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa Sintética E2E');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirme sua senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel('Nome do negócio', { exact: true }).fill('Studio Sintético E2E');
  await page.getByLabel('Link de reserva', { exact: true }).fill(slug);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Perfil profissional' })).toBeVisible();
  await page
    .getByLabel('Especialidade principal (opcional)', { exact: true })
    .fill('Atendimento sintético');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Endereço do negócio' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Primeiro serviço' })).toBeVisible();
  await page.getByLabel('Nome do serviço inicial', { exact: true }).fill('Boas-vindas sintético');
  await page.getByLabel('Preço em reais', { exact: true }).fill('35');
  await page.getByLabel('Duração em minutos', { exact: true }).fill('45');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Horários de funcionamento' })).toBeVisible();
  const onboarding = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/onboarding' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Finalizar e criar agenda', exact: true }).click();
  expect((await onboarding).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Tudo pronto!' })).toBeVisible();
  await expect(page).toHaveURL(/onboarding$/);
  await page.getByRole('button', { name: 'Entrar no painel', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.getByRole('link', { name: 'Serviços', exact: true }).click();
  await page.getByRole('button', { name: 'Novo serviço' }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill('Atendimento sintético');
  await page.getByLabel('Duração em minutos').fill('30');
  await page.getByLabel('Preço em reais').fill('80');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Registro salvo com sucesso.')).toBeVisible();
  await page.getByRole('link', { name: 'Profissionais', exact: true }).click();
  await page.getByRole('button', { name: 'Novo profissional' }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill('Profissional sintético');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Registro salvo com sucesso.')).toBeVisible();
  const publicContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const visitor = await publicContext.newPage();
  await visitor.goto(`/reservar/${slug}`);
  const publicServiceId = await visitor
    .getByRole('option', { name: /Atendimento sintético ·/ })
    .getAttribute('value');
  expect(publicServiceId).toBeTruthy();
  await visitor.getByLabel('Serviço', { exact: true }).selectOption(publicServiceId!);
  await visitor.getByLabel('Profissional', { exact: true }).selectOption({ index: 1 });
  await assertControlBorderContrast(visitor, '#public-name');
  let found = false;
  let bookingDate = '';
  let initialInstant = '';
  let rescheduleInstant = '';
  for (let offset = 1; offset <= 7; offset++) {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const date = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(day);
    await visitor.getByLabel('Data', { exact: true }).fill(date);
    const availability = visitor.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === `/api/v1/public/${slug}/availability` &&
        url.searchParams.get('date') === date
      );
    });
    await visitor.getByRole('button', { name: 'Consultar horários' }).click();
    const availabilityResponse = await availability;
    expect(availabilityResponse.status()).toBe(200);
    const offered = (await availabilityResponse.json()) as { data: string[] };
    await expect(visitor.getByRole('button', { name: 'Consultar horários' })).toBeEnabled();
    await expect(visitor.getByRole('radio')).toHaveCount(offered.data.length);
    if (offered.data.length >= 3) {
      found = true;
      bookingDate = date;
      initialInstant = offered.data[0]!;
      rescheduleInstant = offered.data[2]!;
      break;
    }
  }
  expect(found, 'Ao menos um dia deve oferecer slots reais do servidor').toBe(true);
  await visitor.getByRole('radio').first().check();
  await visitor.getByLabel('Nome', { exact: true }).fill('Cliente Sintético Público');
  await visitor.getByLabel('Telefone com DDD').fill('11999990000');
  await visitor.getByLabel('E-mail (opcional)').fill(`customer-${suffix}@example.test`);
  await visitor.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await expect(visitor.getByRole('heading', { name: 'Reserva solicitada' })).toBeVisible();
  await page.goto('/dashboard/calendar');
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByLabel('Data de referência').fill(bookingDate);
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.getByText('Cliente Sintético Público')).toBeVisible();
  await expect(page).toHaveTitle('Agenda | AgendaFácil');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Agendamento atualizado.')).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Cliente Sintético Público' })
      .getByText('Confirmado', { exact: true }),
  ).toBeVisible();
  const civil = (instant: string) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(new Date(instant))
      .replace(' ', 'T');
  await page.getByRole('button', { name: 'Reagendar', exact: true }).click();
  const rescheduleDialog = page.getByRole('dialog', { name: 'Reagendar atendimento' });
  await rescheduleDialog.getByLabel('Nova data e hora').fill(civil(rescheduleInstant));
  await rescheduleDialog.getByRole('button', { name: 'Confirmar reagendamento' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Agendamento reagendado.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bloquear horário', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar bloqueio', exact: true }).click();
  await expect(page.getByLabel('Início do bloqueio')).toBeFocused();
  await expect(page.getByLabel('Início do bloqueio')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Início do bloqueio')).toHaveAttribute(
    'aria-describedby',
    /block-start-error/,
  );
  await page.getByLabel('Profissional', { exact: true }).nth(1).selectOption({ index: 1 });
  await page.getByLabel('Início do bloqueio').fill(civil(initialInstant));
  await page.getByLabel('Fim do bloqueio').fill(civil(initialInstant));
  await page.getByRole('button', { name: 'Salvar bloqueio', exact: true }).click();
  await expect(page.getByLabel('Fim do bloqueio')).toBeFocused();
  await expect(page.getByLabel('Fim do bloqueio')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#block-end-error')).toBeVisible();
  await page
    .getByLabel('Fim do bloqueio')
    .fill(civil(new Date(Date.parse(initialInstant) + 30 * 60_000).toISOString()));
  await page.getByRole('button', { name: 'Salvar bloqueio', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Horário bloqueado.' })).toBeVisible();
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Calendário de atendimentos' })).toBeVisible();
  for (const view of ['day', 'week', 'month']) {
    await page.getByLabel('Período', { exact: true }).selectOption(view);
    await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Atualizar agenda' })).toBeEnabled();
    await expect(page.locator('.calendar-day').first()).toBeVisible();
    if (view === 'day') await expect(page.locator('.calendar-day')).toHaveCount(1);
    if (view === 'week') await expect(page.locator('.calendar-day')).toHaveCount(7);
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width >= 720) {
      await expect(
        page.getByRole('link', { name: 'AgendaFácil · início', exact: true }),
      ).toBeVisible();
    } else {
      await expect(page.locator('#calendar-scroll-help')).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`calendar-${width}.png`),
      fullPage: true,
    });
  }
  await visitor.getByRole('button', { name: 'Fazer outra reserva' }).click();
  const refreshedAvailability = visitor.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api/v1/public/${slug}/availability` &&
      url.searchParams.get('date') === bookingDate
    );
  });
  await visitor.getByRole('button', { name: 'Consultar horários' }).click();
  const refreshedResponse = await refreshedAvailability;
  expect(refreshedResponse.status()).toBe(200);
  const refreshedSlots = (await refreshedResponse.json()) as { data: string[] };
  await expect(visitor.getByRole('button', { name: 'Consultar horários' })).toBeEnabled();
  await expect(visitor.getByRole('radio')).toHaveCount(refreshedSlots.data.length);
  expect(refreshedSlots.data).not.toContain(initialInstant);
  const blockedTimeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(initialInstant));
  await expect(visitor.getByRole('radio', { name: blockedTimeLabel, exact: true })).toHaveCount(0);
  await visitor.getByRole('radio').first().check();
  await visitor.getByLabel('Nome', { exact: true }).fill('Cliente Sintético Telefone');
  await visitor.getByLabel('E-mail (opcional)').fill('');
  await visitor.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await expect(visitor.getByRole('heading', { name: 'Reserva solicitada' })).toBeVisible();
  await visitor.getByRole('button', { name: 'Cancelar esta reserva', exact: true }).click();
  await visitor
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar cancelamento', exact: true })
    .click();
  await expect(visitor.getByText('Reserva cancelada com sucesso.')).toBeVisible();
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.getByRole('button', { name: 'Remover bloqueio', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Remover bloqueio?' })
    .getByRole('button', { name: 'Remover bloqueio', exact: true })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'Bloqueio removido.' })).toBeVisible();
  await page.goto('/dashboard/settings');
  const monday = page.getByRole('group', { name: 'Segunda-feira', exact: true });
  await expect(monday.getByLabel('Abertura', { exact: true })).toBeVisible();
  await monday.getByLabel('Fechamento', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Salvar expediente', exact: true }).click();
  await expect(monday.getByLabel('Fechamento', { exact: true })).toBeFocused();
  await expect(monday.getByLabel('Fechamento', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(monday.getByLabel('Fechamento', { exact: true })).toHaveAttribute(
    'aria-describedby',
    /business-interval-error-/,
  );
  await page.goto('/dashboard/subscription');
  await expect(page.getByRole('heading', { name: 'Assinatura', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Escolher Starter/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/homologa|indisponível/i);
  await visitor.goto(`/portal/${slug}`);
  await visitor.getByLabel('E-mail', { exact: true }).fill(`customer-${suffix}@example.test`);
  const accessRequest = visitor.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === `/api/v1/public/${slug}/portal/request`,
  );
  await visitor.getByRole('button', { name: 'Receber link de acesso', exact: true }).click();
  const accessResponse = await accessRequest;
  expect(accessResponse.status()).toBe(202);
  expect(await accessResponse.json()).toEqual({
    data: {
      message: 'Se houver um cadastro com este email, você receberá um link de acesso.',
    },
  });
  await expect(
    visitor.getByRole('status').filter({ hasText: 'Se houver atendimentos' }),
  ).toBeVisible();
  const inboxUrl = process.env['MAILPIT_API_URL'] || 'http://127.0.0.1:8025';
  let mailId = '';
  await expect
    .poll(async () => {
      const response = await page.request.get(`${inboxUrl}/api/v1/messages`);
      const inbox = (await response.json()) as {
        messages: { ID: string; To: { Address: string }[] }[];
      };
      mailId =
        inbox.messages.find((item) =>
          item.To.some((to) => to.Address === `customer-${suffix}@example.test`),
        )?.ID ?? '';
      return Boolean(mailId);
    })
    .toBe(true);
  const mailResponse = await page.request.get(`${inboxUrl}/api/v1/message/${mailId}`);
  const mail = (await mailResponse.json()) as { Text: string; HTML: string };
  const token = (mail.Text || mail.HTML).match(/#token=([A-Za-z0-9]{64})/)?.[1];
  expect(Boolean(token), 'O email local deve conter um link de uso único').toBe(true);
  await visitor.goto(`/portal/${slug}#token=${token}`);
  await expect(
    visitor.getByRole('heading', { name: 'Olá, Cliente Sintético Público' }),
  ).toBeVisible();
  await expect(visitor).not.toHaveURL(/#token=/);
  const portalCookie = (await publicContext.cookies()).find(
    (cookie) => cookie.name === 'agenda_customer_portal',
  );
  expect(portalCookie?.httpOnly).toBe(true);
  await visitor.getByRole('button', { name: 'Cancelar reserva', exact: true }).click();
  await visitor.getByRole('button', { name: 'Confirmar cancelamento', exact: true }).click();
  await expect(visitor.getByRole('status').filter({ hasText: 'Reserva cancelada.' })).toBeVisible();
  await expect(visitor.getByText('Cancelado', { exact: true })).toBeVisible();
  await visitor.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(visitor.getByRole('heading', { name: 'Acesse seu portal' })).toBeVisible();
  await publicContext.close();
});
