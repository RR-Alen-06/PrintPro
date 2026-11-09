/**
 * Currency and date formatting utilities
 */

export function formatCurrency(
  amount: number | string | null | undefined,
  symbol = '₹',
  precision = 2
): string {
  const numericVal = Number(amount || 0);
  return `${symbol}${numericVal.toFixed(precision)}`;
}

export function formatDateIndian(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
