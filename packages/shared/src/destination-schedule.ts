export interface DestinationSegment {
  city: string;
  nights: number;
  startDay: number;
  endDay: number;
}

/**
 * Split a multi-city trip once so accommodation and transport agree on the
 * day a traveller changes cities. The first cities receive any extra nights.
 */
export function splitDestinationSchedule(
  destination: string,
  nights: number,
): DestinationSegment[] {
  if (!Number.isSafeInteger(nights) || nights < 1) {
    throw new Error("Destination schedule requires at least one night.");
  }
  const cities = destination
    .split("&")
    .map((city) => city.trim())
    .filter(Boolean);
  if (!cities.length) throw new Error("Destination schedule requires at least one city.");
  if (nights < cities.length) {
    throw new Error("Each destination needs at least one overnight stay.");
  }
  const baseNights = Math.floor(nights / cities.length);
  const extraNights = nights % cities.length;
  let offset = 0;
  return cities.map((city, index) => {
    const cityNights = baseNights + (index < extraNights ? 1 : 0);
    const segment = {
      city,
      nights: cityNights,
      startDay: offset + 1,
      endDay: offset + cityNights,
    };
    offset += cityNights;
    return segment;
  });
}
