export const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const formatMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { currency, style: "currency" }).format(
    cents / 100
  );

export const centsToInput = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

export const inputToCents = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
};
