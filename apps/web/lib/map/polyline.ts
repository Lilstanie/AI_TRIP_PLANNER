import type { Coordinate } from "./itinerary-route";

export function decodePath(value: string): Coordinate[] {
  let i = 0,
    lat = 0,
    lng = 0;
  const path: Coordinate[] = [];
  const read = () => {
    let bits = 0,
      shift = 0,
      byte: number;
    do {
      if (i >= value.length || shift > 30) throw new Error("Invalid route geometry");
      byte = value.charCodeAt(i++) - 63;
      bits |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return bits & 1 ? ~(bits >> 1) : bits >> 1;
  };
  while (i < value.length) {
    lat += read();
    lng += read();
    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}
