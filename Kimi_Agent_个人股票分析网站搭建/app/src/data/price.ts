export function roundPrice(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return +value.toFixed(3);
}

export function formatPrice(value: number | null | undefined): string {
  return roundPrice(value).toFixed(3);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
