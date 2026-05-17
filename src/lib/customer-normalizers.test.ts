import { describe, expect, it } from "vitest";
import { formatBrazilianPhone, normalizeCustomerInput } from "./customer-normalizers";

describe("normalizeCustomerInput", () => {
  it("trims name and strips non-digit characters from phone", () => {
    const result = normalizeCustomerInput({
      name: "  Joao Silva  ",
      phone: "(11) 99999-0000",
    });

    expect(result.name).toBe("Joao Silva");
    expect(result.phone).toBe("11999990000");
    expect(result.email).toBeNull();
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const result = normalizeCustomerInput({
      name: "Maria",
      phone: "11988887777",
      email: "  Maria@Example.COM  ",
    });

    expect(result.email).toBe("maria@example.com");
  });

  it("handles null or undefined email", () => {
    const result = normalizeCustomerInput({
      name: "Test",
      phone: "1234",
      email: null,
    });

    expect(result.email).toBeNull();
  });

  it("extracts exactly 11 digits for mobile numbers", () => {
    const result = normalizeCustomerInput({
      name: "Mobile User",
      phone: "+55 (11) 91234-5678 extra text",
    });

    expect(result.phone).toBe("5511912345678");
  });
});

describe("formatBrazilianPhone", () => {
  it("returns raw digits when length <= 2", () => {
    expect(formatBrazilianPhone("1")).toBe("1");
    expect(formatBrazilianPhone("11")).toBe("11");
  });

  it("formats with area code parentheses for 3 to 7 digits", () => {
    expect(formatBrazilianPhone("113")).toBe("(11) 3");
    expect(formatBrazilianPhone("1191234")).toBe("(11) 91234");
  });

  it("formats full mobile number with hyphen", () => {
    expect(formatBrazilianPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("caps input at 11 digits", () => {
    expect(formatBrazilianPhone("11912345678999")).toBe("(11) 91234-5678");
  });

  it("strips non-digit characters from input", () => {
    expect(formatBrazilianPhone("(11) 91234-5678")).toBe("(11) 91234-5678");
  });
});
