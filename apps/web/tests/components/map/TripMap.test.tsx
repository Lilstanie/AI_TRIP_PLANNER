import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripMap, type MapStop } from "@/components/map/TripMap";
import { useUserLocation } from "@/components/map/useUserLocation";
import type { GooglePlace } from "@/lib/integrations/google";

type MapProps = Omit<Parameters<typeof TripMap>[0], "userLocation" | "stops"> & {
  places: GooglePlace[];
  days?: number[];
};
/** TripMap with the workspace's location hook, and places numbered in the order given. */
function Map({ places, days = [], ...props }: MapProps) {
  const userLocation = useUserLocation();
  const stops: MapStop[] = places.map((place, index) => ({
    place,
    order: index + 1,
    day: days[index],
  }));
  return <TripMap {...props} stops={stops} userLocation={userLocation} />;
}
const museum: GooglePlace = {
  id: "place-1",
  displayName: { text: "Museum" },
  formattedAddress: "1 Museum Way",
  location: { latitude: -33.87, longitude: 151.2 },
};

function setGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"]) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
  vi.unstubAllGlobals();
});

describe("TripMap", () => {
  it("keeps no place list on the map; the Trip drawer lists the places", () => {
    render(<Map places={[museum]} routes={[]} onSelect={() => {}} />);
    expect(screen.queryByRole("list", { name: "Places shown on the map" })).toBeNull();
    expect(document.querySelector(".trip-map-place-list")).toBeNull();
  });

  it("opens the selected place's details with its stop and day, and closes them", () => {
    const { rerender } = render(
      <Map places={[museum]} days={[2]} selected="place-1" routes={[]} onSelect={() => {}} />,
    );
    const popup = screen.getByRole("dialog", { name: "Museum" });
    expect(within(popup).getByText("Stop 1 · Day 2")).toBeTruthy();
    expect(within(popup).getByText("1 Museum Way")).toBeTruthy();

    fireEvent.click(within(popup).getByRole("button", { name: "Close place details" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // Selecting another place (from the drawer, say) opens its details again.
    const other = { ...museum, id: "place-2", displayName: { text: "Harbour" } };
    rerender(<Map places={[museum, other]} selected="place-2" routes={[]} onSelect={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Harbour" })).toBeTruthy();
  });

  it("closes the place details with Escape", () => {
    render(<Map places={[museum]} selected="place-1" routes={[]} onSelect={() => {}} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Close place details" }), {
      key: "Escape",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("requests location only after the user clicks and reports success", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({ coords: { latitude: -33.86, longitude: 151.21 } } as GeolocationPosition);
    });
    setGeolocation(getCurrentPosition);

    render(<Map places={[]} routes={[]} onSelect={() => {}} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show my location" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByText("Your current location is shown on the map.")).toBeTruthy(),
    );
  });

  it("explains denied permission and exposes a retry action", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((_success, failure) => {
      failure?.({ code: 1 } as GeolocationPositionError);
    });
    setGeolocation(getCurrentPosition);

    render(<Map places={[]} routes={[]} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Show my location" }));

    await waitFor(() => expect(screen.getByText(/permission was denied/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Retry my location" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("handles browsers without geolocation", async () => {
    render(<Map places={[]} routes={[]} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Show my location" }));
    await waitFor(() => expect(screen.getByText(/not supported by this browser/i)).toBeTruthy());
  });

  it("looks up a verified route only after location and an explicit click", async () => {
    setGeolocation((success) => {
      success({ coords: { latitude: -33.86, longitude: 151.21 } } as GeolocationPosition);
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        from: "current-location",
        to: "place-1",
        mode: "WALK",
        status: "ok",
        durationMin: 12,
        distanceMeters: 950,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Map places={[museum]} selected="place-1" routes={[]} onSelect={() => {}} />);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show my location" }));
    fireEvent.click(await screen.findByRole("button", { name: "Route from my location" }));
    expect(await screen.findByText(/12 min · 0.9 km/)).toBeTruthy();
  });

  it.each([
    [2, /current location is unavailable/i],
    [3, /timed out/i],
  ])("reports geolocation error code %s", async (code, expectedMessage) => {
    setGeolocation((_success, failure) => {
      failure?.({ code } as GeolocationPositionError);
    });
    render(<Map places={[]} routes={[]} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Show my location" }));
    await waitFor(() => expect(screen.getByText(expectedMessage)).toBeTruthy());
  });
});
