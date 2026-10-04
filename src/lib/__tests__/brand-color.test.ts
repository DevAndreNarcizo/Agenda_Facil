import { describe, expect, it } from "vitest";
import { hexToHslTriplet, isHexColor } from "../brand-color";

describe("brand-color", () => {
  it("valida apenas hexadecimais curtos ou longos", () => {
    expect(isHexColor("#087bf5")).toBe(true);
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("087bf5")).toBe(false);
    expect(isHexColor("red; background:url(x)")).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });

  it("converte hex para o trio HSL das variáveis shadcn", () => {
    expect(hexToHslTriplet("#087bf5")).toBe("211 94% 50%");
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#000")).toBe("0 0% 0%");
  });
});
