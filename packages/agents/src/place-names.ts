export function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function canonicalPlaceName(name: string, places: { name: string }[]): string {
  const match = places.find((place) => normalize(place.name) === normalize(name));
  return match?.name ?? name.trim();
}

export function dedupeEntries<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
