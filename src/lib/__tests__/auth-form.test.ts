import { describe, expect, it } from "vitest";
import { describeAuthError, formatBrPhone, getPasswordStrength, parseAuthProviders, slugify, toE164Br } from "../auth-form";

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

  it("aplica a máscara de WhatsApp progressivamente e gera E.164", () => {
    expect(formatBrPhone("1")).toBe("(1");
    expect(formatBrPhone("1191")).toBe("(11) 91");
    expect(formatBrPhone("1132345678")).toBe("(11) 3234-5678");
    expect(formatBrPhone("11912345678999")).toBe("(11) 91234-5678");
    expect(toE164Br("(11) 91234-5678")).toBe("+5511912345678");
  });

  it("só exibe Google/WhatsApp quando o provedor está ativo no Supabase", () => {
    expect(parseAuthProviders({ external: { google: true, phone: false } })).toEqual({ google: true, whatsapp: false });
    expect(parseAuthProviders({ external: { phone: true }, sms_provider: "messagebird" })).toEqual({ google: false, whatsapp: false });
    expect(parseAuthProviders({ external: { phone: true }, sms_provider: "twilio" })).toEqual({ google: false, whatsapp: true });
    expect(parseAuthProviders(null)).toEqual({ google: false, whatsapp: false });
  });
});
