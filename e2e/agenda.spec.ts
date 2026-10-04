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

    await page.getByRole("button", { name: "Novo agendamento", exact: true }).click();
    await page.locator("#appointment-customer-name").fill(firstCustomer);
    await page.locator("#appointment-customer-phone").fill("62999990000");
    await page.locator(`[data-service-id="${serviceId}"]`).click();
    const createButton = page.getByRole("button", {
      name: "Criar agendamento",
    });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const firstEvent = page.locator("[data-agenda-event]", { hasText: firstCustomer });
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();
    // Painel lateral → modal de reagendamento → confirmar.
    await page.getByRole("button", { name: "Reagendar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reagendar", exact: true }).click();
    await expect(firstEvent).toBeVisible();

    await firstEvent.click();
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();
    await page.getByRole("button", { name: "Marcar como concluído" }).click();
    await expect(firstEvent).toBeVisible();

    await page.getByRole("button", { name: "Novo agendamento", exact: true }).click();
    await page.locator("#appointment-customer-name").fill(secondCustomer);
    await page.locator("#appointment-customer-phone").fill("62999990001");
    await page.locator(`[data-service-id="${serviceId}"]`).click();
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const secondEvent = page.locator("[data-agenda-event]", { hasText: secondCustomer });
    await expect(secondEvent).toBeVisible();
    await secondEvent.click();
    await page.getByRole("button", { name: "Cancelar agendamento" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar agendamento" }).click();
    await expect(secondEvent).toHaveCount(0);
  });
});
