export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  return day.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function quoteNumber(number: number): string {
  return `Q-${String(number).padStart(4, "0")}`;
}

export function invoiceNumber(number: number | null): string {
  return number == null ? "Draft" : `INV-${String(number).padStart(4, "0")}`;
}

export const PAYMENT_METHODS = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;
