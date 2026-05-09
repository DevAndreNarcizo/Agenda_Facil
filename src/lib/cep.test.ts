import { describe, expect, it } from "vitest";
import { formatCep, getCepDigits } from "./cep";

describe("getCepDigits", () => {
  it("mantem somente os 8 primeiros digitos", () => {
    expect(getCepDigits("01001-000")).toBe("01001000");
    expect(getCepDigits("abc 01001-000 999")).toBe("01001000");
  });
});

describe("formatCep", () => {
  it("aplica a mascara quando ha mais de 5 digitos", () => {
    expect(formatCep("01001000")).toBe("01001-000");
  });

  it("nao adiciona hifen antes do sexto digito", () => {
    expect(formatCep("01001")).toBe("01001");
  });
});
