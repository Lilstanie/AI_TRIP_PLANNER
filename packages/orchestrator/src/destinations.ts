const SEPARATORS = /\s*&\s*|\s*、\s*|\s+and\s+/giu;

export function normaliseDestination(value: string): string {
  const cities = value
    .split(SEPARATORS)
    .map((city) => city.trim())
    .filter(Boolean);
  return cities.length ? cities.join(" & ") : value.trim();
}
