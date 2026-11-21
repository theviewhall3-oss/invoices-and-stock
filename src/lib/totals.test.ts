import { describe, expect, it } from "vitest";
import { creditFor, documentTotals, paymentState, toCents } from "./totals";

describe("document totals", () => {
  it("applies line and document discounts before tax", () => {
    const totals = documentTotals(
      [
        { quantity: 4, unitPrice: 4500, discountRate: 0, taxRate: 10 },
        { quantity: 2, unitPrice: 1000, discountRate: 50, taxRate: 0 },
      ],
      10,
    );
    expect(totals).toEqual({
      subtotal: 19000,
      discountTotal: 1900,
      taxTotal: 1620,
      total: 18720,
    });
  });

  it("credits a returned unit with its tax", () => {
    const line = { quantity: 4, unitPrice: 4500, discountRate: 0, taxRate: 10 };
    expect(creditFor(line, 0, 1)).toEqual({ net: 4500, tax: 450 });
  });

  it("reads payment state from the balance and due date", () => {
    const base = { total: 1000, credited: 0, dueDate: "2026-01-10" };
    const at = (paid: number, today: string) =>
      paymentState({ ...base, paid, today });
    expect(at(0, "2026-01-01")).toBe("unpaid");
    expect(at(400, "2026-01-01")).toBe("partially_paid");
    expect(at(400, "2026-02-01")).toBe("overdue");
    expect(at(1000, "2026-02-01")).toBe("paid");
  });

  it("parses amounts to cents", () => {
    expect(toCents("12.5")).toBe(1250);
    expect(Number.isNaN(toCents("abc"))).toBe(true);
    expect(Number.isNaN(toCents(""))).toBe(true);
  });
});
