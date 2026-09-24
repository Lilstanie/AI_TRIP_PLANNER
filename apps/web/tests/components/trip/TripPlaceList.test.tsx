import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TripPlaceList } from "@/components/trip/TripPlaceList";
import type { TripPlaces } from "@/components/map/useTripPlaces";
import type { GooglePlace } from "@/lib/integrations/google";

const place = (id: string, name: string): GooglePlace => ({
  id,
  displayName: { text: name },
  location: { latitude: 1, longitude: 1 },
});
const activities = [
  {
    id: "a3",
    kind: "activity",
    detail: "Dinner by the water",
    day: 1,
    startTime: "18:00",
    endTime: "20:00",
  },
  {
    id: "a1",
    kind: "activity",
    detail: "Morning at the gallery",
    day: 1,
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "a2",
    kind: "activity",
    detail: "Unnamed walk",
    day: 2,
    startTime: "10:00",
    endTime: "11:00",
  },
];
const places: Record<string, GooglePlace> = {
  gallery: place("gallery", "Art Gallery"),
  quay: place("quay", "Circular Quay"),
};
const placeFor: Record<string, string> = { a1: "gallery", a3: "quay" };
const tripPlaces = {
  activities,
  places,
  markers: [
    { activityId: "a1", place: places.gallery!, verified: true, order: 1, day: 1 },
    { activityId: "a3", place: places.quay!, verified: false, order: 2, day: 1 },
  ],
  placeIdFor: (activity: { id?: string }) => placeFor[activity.id!],
  locationStatus: (activity: { id?: string }) =>
    placeFor[activity.id!] ? "located" : "unconfirmed",
} as unknown as TripPlaces;

describe("TripPlaceList", () => {
  it("lists places per day in visiting order and selects a stop on the map", () => {
    const onSelect = vi.fn();
    render(
      <TripPlaceList
        tripPlaces={tripPlaces}
        startDate="2026-10-01"
        selected="a3"
        onSelect={onSelect}
      />,
    );
    const day1 = screen.getByRole("list", { name: "Places, Day 1 · 2026-10-01" });
    const stops = within(day1).getAllByRole("button");
    expect(stops.map((button) => button.textContent)).toEqual([
      "1Stop 1: Art Gallery09:00–11:00 · Morning at the gallery",
      "2Stop 2: Circular Quay18:00–20:00 · Dinner by the water",
    ]);
    expect(within(day1).getByRole("button", { name: /Circular Quay/, pressed: true })).toBeTruthy();

    fireEvent.click(stops[0]!);
    expect(onSelect).toHaveBeenCalledWith("a1");

    // A stop without a place is listed but has nothing to select on the map.
    const day2 = screen.getByRole("list", { name: "Places, Day 2 · 2026-10-02" });
    expect(within(day2).queryByRole("button")).toBeNull();
    expect(within(day2).getByText(/Location to be confirmed/)).toBeTruthy();
  });
});
