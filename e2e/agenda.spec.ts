import { expect, test, type Page } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const serviceId = process.env.E2E_SERVICE_ID;

const hasOwnerCredentials = Boolean(ownerEmail && ownerPassword && serviceId);

/**
 * Autentica uma conta exclusiva do ambiente de teste pelo fluxo real da interface.
 *
 * @author André Narcizo
 */
async function loginAsTestOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(ownerEmail ?? "");
  await page.locator("#password").fill(ownerPassword ?? "");
  await page.getByRole("button", { name: "Entrar no Painel" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("agenda operacional", () => {
  test.skip(
    !hasOwnerCredentials,
    "Defina E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD e E2E_SERVICE_ID no ambiente de teste isolado.",
  );

  test("cria, reage, confirma, conclui e cancela pelo calendário", async ({
    page,
  }) => {
    const firstCustomer = `Cliente E2E ${Date.now()}`;
    const secondCustomer = `${firstCustomer} cancelado`;

    await loginAsTestOwner(page);
    await page.goto("/dashboard/calendar?view=day");

    await page.getByRole("button", { name: "Novo agendamento" }).click();
    await page.locator("#appointment-customer-name").fill(firstCustomer);
    await page.locator("#appointment-customer-phone").fill("62999990000");
    await page.locator("#appointment-service").selectOption(serviceId ?? "");
    const createButton = page.getByRole("button", {
      name: "Criar agendamento",
    });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const firstEvent = page.locator(".rbc-event", { hasText: firstCustomer });
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();
    await page.getByRole("button", { name: "Reagendar" }).click();
    await page.getByRole("button", { name: "Reagendar" }).click();
    await expect(firstEvent).toBeVisible();

    await firstEvent.click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();
    await page.getByRole("button", { name: "Concluir" }).click();
    await expect(firstEvent).toBeVisible();

    await page.getByRole("button", { name: "Novo agendamento" }).click();
    await page.locator("#appointment-customer-name").fill(secondCustomer);
    await page.locator("#appointment-customer-phone").fill("62999990001");
    await page.locator("#appointment-service").selectOption(serviceId ?? "");
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const secondEvent = page.locator(".rbc-event", { hasText: secondCustomer });
    await expect(secondEvent).toBeVisible();
    await secondEvent.click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(secondEvent).toHaveCount(0);
  });
});
