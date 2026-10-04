import { describe, expect, it } from "vitest";
import { findConflict, layoutDayItems, type AgendaItem } from "../agenda-model";

/**
 * Cria um item mínimo de agenda para os cenários de teste.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function item(key: string, startMin: number, endMin: number, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    key, kind: "appointment", status: "confirmed", title: key, subtitle: "", dateKey: "2026-09-25",
    startMin, endMin, employeeId: "pro-1", ...extra,
  };
}

describe("layoutDayItems", () => {
  it("mantém largura total para itens sem sobreposição", () => {
    const result = layoutDayItems([item("a", 540, 600), item("b", 600, 660)]);
    expect(result.map(({ key, lane, lanes }) => [key, lane, lanes])).toEqual([["a", 0, 1], ["b", 0, 1]]);
  });

  it("divide itens sobrepostos em faixas e reaproveita faixas livres", () => {
    const result = layoutDayItems([item("a", 540, 660), item("b", 570, 600), item("c", 600, 630)]);
    const byKey = Object.fromEntries(result.map((entry) => [entry.key, entry]));
    expect(byKey.a.lane).toBe(0);
    expect(byKey.b.lane).toBe(1);
    expect(byKey.c.lane).toBe(1);
    expect(result.every((entry) => entry.lanes === 2)).toBe(true);
  });
});

describe("findConflict", () => {
  it("acusa sobreposição com o mesmo profissional", () => {
    const conflict = findConflict([item("a", 540, 600)], { dateKey: "2026-09-25", startMin: 570, endMin: 630, employeeId: "pro-1" });
    expect(conflict?.key).toBe("a");
  });

  it("ignora outro profissional, horário adjacente e o próprio agendamento", () => {
    const items = [item("a", 540, 600)];
    expect(findConflict(items, { dateKey: "2026-09-25", startMin: 570, endMin: 630, employeeId: "pro-2" })).toBeNull();
    expect(findConflict(items, { dateKey: "2026-09-25", startMin: 600, endMin: 660, employeeId: "pro-1" })).toBeNull();
    expect(findConflict(items, { dateKey: "2026-09-25", startMin: 540, endMin: 600, employeeId: "pro-1", ignoreKey: "a" })).toBeNull();
  });

  it("considera bloqueios da organização inteira para qualquer profissional", () => {
    const block = item("b", 720, 780, { kind: "block", status: "block", employeeId: null });
    expect(findConflict([block], { dateKey: "2026-09-25", startMin: 750, endMin: 810, employeeId: "pro-9" })?.key).toBe("b");
  });
});
