export const normal = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

export const cityNames = (destination: string) =>
  destination
    .split(/\s*&\s*/)
    .map(normal)
    .filter(Boolean);
