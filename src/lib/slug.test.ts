import { describe, expect, it, vi } from "vitest";
import {
  isDuplicateSlugError,
  isValidOrganizationSlug,
  normalizeSlug,
  validateOrganizationSlugAvailability,
} from "./slug";

describe("normalizeSlug", () => {
  it("normaliza acentos, espacos e caracteres especiais", () => {
    expect(normalizeSlug(" Studio Alessa & Cia! ")).toBe("studio-alessa-cia");
    expect(normalizeSlug("Salão da Júlia")).toBe("salao-da-julia");
    expect(normalizeSlug("barbearia---premium")).toBe("barbearia-premium");
  });

  it("usa fallback quando o valor nao gera slug valido", () => {
    expect(normalizeSlug("!!!", "minha-empresa")).toBe("minha-empresa");
  });
});

describe("isValidOrganizationSlug", () => {
  it("aceita apenas slug normalizado com pelo menos 3 caracteres", () => {
    expect(isValidOrganizationSlug("studio-alessa")).toBe(true);
    expect(isValidOrganizationSlug("s01")).toBe(true);
    expect(isValidOrganizationSlug("ab")).toBe(false);
    expect(isValidOrganizationSlug("Studio")).toBe(false);
    expect(isValidOrganizationSlug("studio_alessa")).toBe(false);
  });
});

describe("validateOrganizationSlugAvailability", () => {
  it("nao consulta a base quando o slug e invalido", async () => {
    const lookup = vi.fn();

    await expect(validateOrganizationSlugAvailability("ab", lookup)).resolves.toEqual({ status: "invalid" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("retorna disponivel quando nao existe organizacao com o slug", async () => {
    const lookup = vi.fn().mockResolvedValue(null);

    await expect(validateOrganizationSlugAvailability("Studio Alessa", lookup)).resolves.toEqual({ status: "available" });
    expect(lookup).toHaveBeenCalledWith("studio-alessa");
  });

  it("bloqueia slug ja usado por outra organizacao", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: "org-2" });

    await expect(validateOrganizationSlugAvailability("studio-alessa", lookup, "org-1")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("permite manter o proprio slug nas configuracoes", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: "org-1" });

    await expect(validateOrganizationSlugAvailability("studio-alessa", lookup, "org-1")).resolves.toEqual({
      status: "available",
    });
  });

  it("retorna erro quando a consulta falha", async () => {
    const error = new Error("network");
    const lookup = vi.fn().mockRejectedValue(error);

    await expect(validateOrganizationSlugAvailability("studio-alessa", lookup)).resolves.toEqual({
      status: "error",
      error,
    });
  });
});

describe("isDuplicateSlugError", () => {
  it("identifica erro de constraint unica do slug da organizacao", () => {
    expect(
      isDuplicateSlugError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "organizations_slug_key"',
      }),
    ).toBe(true);
  });

  it("ignora outros erros de constraint", () => {
    expect(
      isDuplicateSlugError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_pkey"',
      }),
    ).toBe(false);
  });
});
