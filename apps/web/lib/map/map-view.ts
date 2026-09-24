/**
 * Automatic map framing, independent of the Google Maps SDK so it can be tested.
 *
 * The map frames a trip at most twice: first on its destination (as soon as the city is
 * known), then once on its activity places. It never refits on ordinary re-renders, and once
 * the user drags or zooms it leaves the view alone until the trip or destination changes.
 */
export type LatLng = { lat: number; lng: number };

export interface FramableMap {
  center(point: LatLng, zoom: number): void;
  fit(points: LatLng[], maxZoom: number): void;
}

export const CITY_ZOOM = 12;
export const PLACE_ZOOM = 14;
export const MAX_DESTINATION_ZOOM = 12;
export const MAX_PLACES_ZOOM = 15;

type Stage = "none" | "destination" | "places";

export function frame(map: FramableMap, points: LatLng[], kind: "destination" | "places") {
  if (!points.length) return false;
  if (points.length === 1) map.center(points[0]!, kind === "destination" ? CITY_ZOOM : PLACE_ZOOM);
  else map.fit(points, kind === "destination" ? MAX_DESTINATION_ZOOM : MAX_PLACES_ZOOM);
  return true;
}

export class MapViewController {
  private key: string | undefined;
  private stage: Stage = "none";
  private userMoved = false;
  private framedDestinations = 0;

  constructor(private readonly map: FramableMap) {}

  /** Apply the automatic view for the current trip. Returns true when the map moved. */
  update({ key, destinations, places }: { key: string; destinations: LatLng[]; places: LatLng[] }) {
    if (key !== this.key) {
      this.key = key;
      this.stage = "none";
      this.userMoved = false;
      this.framedDestinations = 0;
    }
    if (this.userMoved) return false;
    if (places.length && this.stage !== "places") {
      frame(this.map, places, "places");
      this.stage = "places";
      return true;
    }
    // Destination cities resolve one by one; widen the frame as a multi-city trip completes.
    const moreDestinations =
      this.stage === "destination" && destinations.length > this.framedDestinations;
    if (!places.length && destinations.length && (this.stage === "none" || moreDestinations)) {
      frame(this.map, destinations, "destination");
      this.stage = "destination";
      this.framedDestinations = destinations.length;
      return true;
    }
    return false;
  }

  /** The user dragged, zoomed or otherwise moved the map. */
  markUserMoved() {
    this.userMoved = true;
  }

  get hasView() {
    return this.stage !== "none";
  }
}
