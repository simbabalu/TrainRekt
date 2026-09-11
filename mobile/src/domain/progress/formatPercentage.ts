export function formatPercentage(percentage: number): string {
  const rounded = Math.round(percentage * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}