export const SUPPORTED_CURRENCIES = ["USD", "GBP", "EUR", "AED"] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  AED: "د.إ",
};

export function formatMoney(amount: number | null | undefined, currency: string = "USD"): string {
  const value = Number(amount ?? 0);
  const symbol = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  paid: "bg-green-500/10 text-green-700 dark:text-green-300",
  overdue: "bg-red-500/10 text-red-700 dark:text-red-300",
  canceled: "bg-muted text-muted-foreground line-through",
};

export const BONUS_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  paid: "bg-green-500/10 text-green-700 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground line-through",
};
