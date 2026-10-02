export const normal = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** The cities of a trip in travel order. A multi-city destination joins them with "&". */
export const cityNames = (destination: string) =>
  destination
    .split(/\s*&\s*/)
    .map(normal)
    .filter(Boolean);
