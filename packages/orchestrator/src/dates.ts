/**
 * Reading a date a traveller typed.
 *
 * ISO is unambiguous and always wins. Month names are unambiguous too, so
 * "2 Nov 2026" and "Nov 2, 2026" both read cleanly.
 *
 * Bare numeric dates are the problem: 11/02/2026 is 2 November to an American
 * and 11 February to an Australian, and this product has users of both kinds —
 * the workspace even renders saved dates in the viewer's own locale. Where one
 * component settles it (13/05/2026 has no 13th month) the date is read. Where
 * nothing settles it, this reports ambiguity instead of guessing: a wrong guess
 * shifts the whole trip by months and prices the wrong flights, and no check
 * downstream would notice.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/** One date as it may appear in a sentence. Bare `-` is not a separator here: it would collide with 2-11-2026. */
export const DATE_TOKEN =
  "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9},?\\s+\\d{4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4})";

export type ParsedDate = { iso: string } | { ambiguous: true } | undefined;

function iso(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Rejects 31 February and friends by round-tripping through the calendar.
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

  // "2 Nov 2026" / "2 November, 2026"
  const dayFirst = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]!.toLowerCase()];
    const value = month && iso(+dayFirst[3]!, month, +dayFirst[1]!);
    return value ? { iso: value } : undefined;
  }

  // "Nov 2 2026" / "November 2, 2026"
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
      const value = iso(year, b, a); // only day/month works
      return value ? { iso: value } : undefined;
    }
    if (b > 12 && a <= 12) {
      const value = iso(year, a, b); // only month/day works
      return value ? { iso: value } : undefined;
    }
    if (a > 12 && b > 12) return undefined; // neither reading is a date
    return { ambiguous: true };
  }

  return undefined;
}

export const isAmbiguous = (parsed: ParsedDate): boolean =>
  !!parsed && "ambiguous" in parsed;
