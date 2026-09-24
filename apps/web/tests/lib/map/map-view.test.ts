import { describe, expect, it, vi } from "vitest";
import {
  CITY_ZOOM,
  MAX_DESTINATION_ZOOM,
  MAX_PLACES_ZOOM,
  MapViewController,
  PLACE_ZOOM,
} from "@/lib/map/map-view";

const tokyo = { lat: 35.68, lng: 139.76 };
const kyoto = { lat: 35.01, lng: 135.77 };
const temple = { lat: 34.98, lng: 135.75 };
const market = { lat: 35.0, lng: 135.76 };
const fakeMap = () => ({ center: vi.fn(), fit: vi.fn() });

describe("map framing", () => {
  it("centres a single destination at city zoom before any activity is mapped", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    expect(view.update({ key: "trip-a|Tokyo", destinations: [tokyo], places: [] })).toBe(true);
    expect(map.center).toHaveBeenCalledWith(tokyo, CITY_ZOOM);
  });

  it("fits a multi-city destination with a zoom cap", () => {
    const map = fakeMap();
    new MapViewController(map).update({ key: "k", destinations: [tokyo, kyoto], places: [] });
    expect(map.fit).toHaveBeenCalledWith([tokyo, kyoto], MAX_DESTINATION_ZOOM);
  });

  it("widens the frame as the cities of a multi-city trip resolve one by one", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    view.update({ key: "k", destinations: [kyoto], places: [] });
    expect(map.center).toHaveBeenCalledWith(kyoto, CITY_ZOOM);
    expect(view.update({ key: "k", destinations: [kyoto, tokyo], places: [] })).toBe(true);
    expect(map.fit).toHaveBeenCalledWith([kyoto, tokyo], MAX_DESTINATION_ZOOM);
    expect(view.update({ key: "k", destinations: [kyoto, tokyo], places: [] })).toBe(false);
  });

  it("does not widen the destination frame after the user moved the map", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    view.update({ key: "k", destinations: [kyoto], places: [] });
    view.markUserMoved();
    expect(view.update({ key: "k", destinations: [kyoto, tokyo], places: [] })).toBe(false);
    expect(map.fit).not.toHaveBeenCalled();
  });

  it("fits activity places once and does not refit on later updates", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    view.update({ key: "k", destinations: [kyoto], places: [] });
    view.update({ key: "k", destinations: [kyoto], places: [temple, market] });
    expect(map.fit).toHaveBeenCalledWith([temple, market], MAX_PLACES_ZOOM);
    map.fit.mockClear();
    map.center.mockClear();
    expect(view.update({ key: "k", destinations: [kyoto], places: [temple, market] })).toBe(false);
    expect(view.update({ key: "k", destinations: [kyoto], places: [temple] })).toBe(false);
    expect(map.fit).not.toHaveBeenCalled();
    expect(map.center).not.toHaveBeenCalled();
  });

  it("never takes the view back after the user moves the map", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    view.update({ key: "k", destinations: [kyoto], places: [] });
    view.markUserMoved();
    map.center.mockClear();
    expect(view.update({ key: "k", destinations: [kyoto], places: [temple] })).toBe(false);
    expect(map.center).not.toHaveBeenCalled();
  });

  it("reframes when the trip changes, even after the user moved the map", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    view.update({ key: "trip-a|Kyoto", destinations: [kyoto], places: [temple] });
    view.markUserMoved();
    view.update({ key: "trip-b|Tokyo", destinations: [tokyo], places: [] });
    expect(map.center).toHaveBeenLastCalledWith(tokyo, CITY_ZOOM);
  });

  it("keeps the last view when nothing can be located", () => {
    const map = fakeMap();
    const view = new MapViewController(map);
    view.update({ key: "k", destinations: [kyoto], places: [] });
    map.center.mockClear();
    expect(view.update({ key: "k", destinations: [], places: [] })).toBe(false);
    expect(map.center).not.toHaveBeenCalled();
    expect(view.hasView).toBe(true);
  });
});
