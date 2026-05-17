import { describe, expect, it } from "vitest";
import { holidays } from "./holidays";

describe("holidays", () => {
  it("contains national holidays for 2025 and 2026", () => {
    expect(holidays.length).toBeGreaterThan(0);

    const dates = holidays.map((h) => h.date);
    expect(dates).toContain("2025-01-01");
    expect(dates).toContain("2025-12-25");
    expect(dates).toContain("2026-01-01");
  });

  it("every holiday has name and date", () => {
    for (const holiday of holidays) {
      expect(holiday).toHaveProperty("date");
      expect(holiday).toHaveProperty("name");
      expect(typeof holiday.date).toBe("string");
      expect(typeof holiday.name).toBe("string");
    }
  });
});
