import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlacePreview } from "@/components/map/PlacePreview";
import { TripMap } from "@/components/map/TripMap";
import type { UserLocation } from "@/components/map/useUserLocation";
import type { GooglePlace } from "@/lib/integrations/google";

const place: GooglePlace = {
  id: "place-1",
  displayName: { text: "The Rocks" },
  formattedAddress: "Sydney NSW 2000, Australia",
  googleMapsUri: "https://maps.google.com/?cid=1",
  location: { latitude: -33.86, longitude: 151.21 },
  photos: [
    {
      name: "places/place-1/photos/one",
      authorAttributions: [{ displayName: "Ada", uri: "https://maps.google.com/ada" }],
    },
  ],
};

const noLocation: UserLocation = {
  location: { status: "idle" },
  asking: false,
  request() {},
  allow() {},
  dismiss() {},
};
const stops = (...places: GooglePlace[]) =>
  places.map((item, index) => ({ place: item, order: index + 1 }));

const photo = (container: HTMLElement) => container.querySelector("img");

describe("PlacePreview", () => {
  it("loads the first photo through the server route and credits its author", () => {
    const { container } = render(<PlacePreview place={place} showPhoto />);

    expect(photo(container)?.getAttribute("src")).toBe(
      "/api/places/photo?name=places%2Fplace-1%2Fphotos%2Fone&width=400",
    );
    expect(photo(container)?.getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("link", { name: "Ada" }).getAttribute("href")).toBe(
      "https://maps.google.com/ada",
    );
    expect(screen.getByRole("heading", { name: "The Rocks" })).toBeTruthy();
    expect(screen.getByText("Sydney NSW 2000, Australia")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toBeTruthy();
  });

  it("requests no photo, and credits no one, when photos are off", () => {
    const { container } = render(<PlacePreview place={place} showPhoto={false} />);

    expect(photo(container)).toBeNull();
    expect(screen.queryByText(/Photo:/)).toBeNull();
    expect(screen.getByRole("heading", { name: "The Rocks" })).toBeTruthy();
  });

  it("falls back to the pin, dropping the credit, when the image fails to load", () => {
    const { container } = render(<PlacePreview place={place} showPhoto />);

    fireEvent.error(photo(container)!);

    expect(photo(container)).toBeNull();
    expect(screen.queryByText(/Photo:/)).toBeNull();
  });

  it("keeps the slot for a place Google has no photo of", () => {
    const { container } = render(
      <PlacePreview place={{ ...place, photos: undefined }} showPhoto />,
    );

    expect(photo(container)).toBeNull();
    expect(container.querySelector(".place-preview__photo")).not.toBeNull();
  });
});

describe("TripMap place preview", () => {
  it("previews only the selected place, passing the photo setting through", () => {
    const other = { ...place, id: "place-2", displayName: { text: "Bondi Beach" } };
    const { container, rerender } = render(
      <TripMap
        stops={stops(place, other)}
        routes={[]}
        onSelect={() => {}}
        showPhotos
        userLocation={noLocation}
      />,
    );
    expect(container.querySelector(".place-preview")).toBeNull();

    rerender(
      <TripMap
        stops={stops(place, other)}
        selected="place-2"
        routes={[]}
        onSelect={() => {}}
        showPhotos
        userLocation={noLocation}
      />,
    );

    expect(screen.getByRole("article", { name: "Selected place: Bondi Beach" })).toBeTruthy();
    expect(photo(container)).not.toBeNull();
  });
});
