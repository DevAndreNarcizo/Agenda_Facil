import { describe, expect, it } from "vitest";
import { describeAuthError, getPasswordStrength, slugify } from "../auth-form";

describe("auth-form", () => {
  it("pontua a força da senha a partir do comprimento mínimo", () => {
    expect(getPasswordStrength("abc")).toBe(0);
    expect(getPasswordStrength("abcdefgh")).toBe(1);
    expect(getPasswordStrength("abcdefg1")).toBe(2);
    expect(getPasswordStrength("Abcdefg1")).toBe(3);
    expect(getPasswordStrength("Abcdefgh1!xyz")).toBe(4);
  });

  it("gera o slug da página de reserva sem acentos nem símbolos", () => {
    expect(slugify("  Estúdio Ágata & Cia ")).toBe("estudio-agata-cia");
    expect(slugify("---")).toBe("");
  });

  it("traduz erros conhecidos do Supabase e usa o fallback nos demais", () => {
    expect(describeAuthError(new Error("Invalid login credentials"), "x")).toBe("E-mail ou senha incorretos.");
    expect(describeAuthError(new Error("Database error saving new user"), "x")).toMatch(/link de reserva/);
    expect(describeAuthError(new Error("boom"), "Falhou")).toBe("Falhou");
    expect(describeAuthError("texto", "Falhou")).toBe("Falhou");
  });
});
