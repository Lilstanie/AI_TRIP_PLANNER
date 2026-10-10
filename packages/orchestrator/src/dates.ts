const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export const DATE_TOKEN =
  "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9},?\\s+\\d{4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4})";

export type ParsedDate = { iso: string } | { ambiguous: true } | undefined;

function iso(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export function parseTripDate(token: string): ParsedDate {
  const text = token.trim();

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const value = iso(+isoMatch[1]!, +isoMatch[2]!, +isoMatch[3]!);
    return value ? { iso: value } : undefined;
  }

  const dayFirst = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]!.toLowerCase()];
    const value = month && iso(+dayFirst[3]!, month, +dayFirst[1]!);
    return value ? { iso: value } : undefined;
  }

  const monthFirst = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]!.toLowerCase()];
    const value = month && iso(+monthFirst[3]!, month, +monthFirst[2]!);
    return value ? { iso: value } : undefined;
  }

  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (numeric) {
    const [a, b, year] = [+numeric[1]!, +numeric[2]!, +numeric[3]!];
    if (a > 12 && b <= 12) {
      const value = iso(year, b, a);
      return value ? { iso: value } : undefined;
    }
    if (b > 12 && a <= 12) {
      const value = iso(year, a, b);
      return value ? { iso: value } : undefined;
    }
    if (a > 12 && b > 12) return undefined;
    return { ambiguous: true };
  }

  return undefined;
}

export const isAmbiguous = (parsed: ParsedDate): boolean => !!parsed && "ambiguous" in parsed;
