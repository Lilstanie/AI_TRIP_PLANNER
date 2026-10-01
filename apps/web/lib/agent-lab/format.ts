export function money(value: number): string {
  return `A$${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}
