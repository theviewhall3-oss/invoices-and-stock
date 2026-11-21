/** A document line as entered: money in cents, rates in percent. */
interface LineInput {
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
}

interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

const cents = (value: number) => Math.round(value);

/** A line's net (after its own discount) and its tax after both discounts. */
function lineTotals(
  line: LineInput,
  documentDiscountRate: number,
): { net: number; tax: number } {
  const net = cents(
    line.quantity * line.unitPrice * (1 - line.discountRate / 100),
  );
  const taxable = net * (1 - documentDiscountRate / 100);
  return { net, tax: cents((taxable * line.taxRate) / 100) };
}

export function documentTotals(
  lines: LineInput[],
  discountRate: number,
): DocumentTotals {
  let subtotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    const totals = lineTotals(line, discountRate);
    subtotal += totals.net;
    taxTotal += totals.tax;
  }
  const discountTotal = cents((subtotal * discountRate) / 100);
  return {
    subtotal,
    discountTotal,
    taxTotal,
    total: subtotal - discountTotal + taxTotal,
  };
}

/** What returning `quantity` of a line credits back, after both discounts. */
export function creditFor(
  line: LineInput,
  documentDiscountRate: number,
  quantity: number,
): { net: number; tax: number } {
  const unitNet =
    line.unitPrice *
    (1 - line.discountRate / 100) *
    (1 - documentDiscountRate / 100);
  const net = cents(unitNet * quantity);
  return { net, tax: cents((net * line.taxRate) / 100) };
}

export type PaymentState = "unpaid" | "partially_paid" | "paid" | "overdue";

export function paymentState(input: {
  total: number;
  paid: number;
  credited: number;
  dueDate: string;
  today: string;
}): PaymentState {
  const balance = input.total - input.paid - input.credited;
  if (balance <= 0) return "paid";
  if (input.dueDate < input.today) return "overdue";
  if (input.paid > 0 || input.credited > 0) return "partially_paid";
  return "unpaid";
}

/** "12.50" to 1250 cents; NaN when it isn't a number. */
export function toCents(value: string | number): number {
  const number = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(number) && String(value).trim() !== ""
    ? Math.round(number * 100)
    : NaN;
}

export function fromCents(value: number): string {
  return (value / 100).toFixed(2);
}

export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}
