/**
 * A trip's cover. Trips keep no photos of their own (place photos come from live lookups that may
 * not be cached), so the cover is a gradient picked from the destination's name: the same trip
 * always gets the same colours, and different destinations read apart at a glance.
 */
const PALETTES = [
  ["#1f4e79", "#4fa3d1"],
  ["#23395b", "#8e5b9f"],
  ["#1d5c4d", "#63b58f"],
  ["#6b2d3c", "#d8795a"],
  ["#2f3e75", "#5ec2c9"],
  ["#4a3b1f", "#d3a44c"],
  ["#3c2a5e", "#d06b9c"],
  ["#20505f", "#9cc46b"],
] as const;

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.codePointAt(0)!) >>> 0;
  return value;
}

export function coverColours(destination: string) {
  return PALETTES[hash(destination.trim().toLowerCase()) % PALETTES.length]!;
}

export function TripCover({ destination, size }: { destination: string; size: "thumb" | "card" }) {
  const [from, to] = coverColours(destination);
  const initial = destination.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={`trip-cover trip-cover--${size}`}
      aria-hidden="true"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="trip-cover__initial">{initial}</span>
    </span>
  );
}
