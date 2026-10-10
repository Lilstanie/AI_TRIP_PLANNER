import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripPlan } from "@trip/shared";
import { useTripPlaces } from "@/components/map/useTripPlaces";
import { plan as seed } from "@/tests/fixtures/workspace";
import { identifyActivities } from "@/lib/workspace";

const withActivity = (tripId: string, detail: string): TripPlan => {
  const plan = identifyActivities(structuredClone(seed));
  plan.tripId = tripId;
  plan.brief.tripId = tripId;

  Object.assign(plan.sections[0]!.proposal!.items[0]!, {
    detail,
    day: 1,
    startTime: "09:00",
    endTime: "10:00",
  });
  return plan;
};
const place = (id: string, name: string) => ({
  id,
  displayName: { text: name },
  location: { latitude: -33.86, longitude: 151.21 },
});

function Probe({ plan }: { plan?: TripPlan }) {
  const { itinerary, loading } = useTripPlaces(plan);
  const markers = itinerary.markersFor();
  return (
    <p data-testid="markers" data-loading={loading}>
      {markers.map((marker) => marker.place.displayName?.text).join(",")}
    </p>
  );
}

describe("trip place resolution", () => {
  it("matches a named activity at runtime without writing a place ID into the plan", async () => {
    const plan = withActivity("a", "Museum");
    const fetcher = vi.fn(async (_url: string) =>
      Response.json({ places: [place("g-1", "Verified")] }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Probe plan={plan} />);
    await waitFor(() => expect(screen.getByTestId("markers").textContent).toBe("Verified"));
    expect(fetcher.mock.calls[0]![0]).toBe("/api/places/search");
    expect(plan.sections[0]!.proposal!.items[0]!.placeId).toBeUndefined();
  });

  it("ignores a late lookup for the previous trip", async () => {
    const resolvers: Record<string, (response: Response) => void> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((resolve) => {
            resolvers[JSON.parse(init.body as string).text] = resolve;
          }),
      ),
    );
    const view = render(<Probe plan={withActivity("old", "Old museum")} />);
    view.rerender(<Probe plan={withActivity("new", "New gallery")} />);

    await act(async () => {
      resolvers["Sydney"]!(Response.json({ places: [place("city", "Sydney")] }));
    });
    await act(async () => {
      resolvers["Old museum"]!(Response.json({ places: [place("old", "Old museum")] }));
    });

    expect(screen.getByTestId("markers").textContent).toBe("");
    expect(screen.getByTestId("markers").dataset.loading).toBe("true");
    await act(async () => {
      resolvers["New gallery"]!(Response.json({ places: [place("new", "New gallery")] }));
    });
    await waitFor(() => expect(screen.getByTestId("markers").textContent).toBe("New gallery"));
    expect(screen.getByTestId("markers").dataset.loading).toBe("false");
  });

  it("does not look anything up for a blank conversation", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<Probe />);
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByTestId("markers").textContent).toBe("");
  });

  it("does not search descriptive text, and resolves the destination city on its own", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return Response.json({ places: [place("city", "Sydney")] });
      }),
    );
    function Destinations({ plan }: { plan: TripPlan }) {
      const { destinations, destinationsSettled, unconfirmed, itinerary } = useTripPlaces(plan);
      const markers = itinerary.markersFor();
      return (
        <p data-testid="state">
          {JSON.stringify({
            destinations: destinations.map((item) => item.id),
            destinationsSettled,
            unconfirmed,
            markers: markers.length,
          })}
        </p>
      );
    }
    render(
      <Destinations
        plan={withActivity(
          "a",
          "Arrival-day orientation walk at the grounded candidate; settle in.",
        )}
      />,
    );
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual({
        destinations: ["city"],
        destinationsSettled: true,
        unconfirmed: 1,
        markers: 0,
      }),
    );
    expect(bodies).toEqual([{ text: "Sydney" }]);
  });

  it("keeps earlier places when a later lookup times out", async () => {
    let fail = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const { text } = JSON.parse(init.body as string);
        if (fail && text !== "Sydney") throw new TypeError("network timeout");
        return Response.json({ places: [place(text, text)] });
      }),
    );
    const view = render(<Probe plan={withActivity("a", "Opera House")} />);
    await waitFor(() => expect(screen.getByTestId("markers").textContent).toBe("Opera House"));
    fail = true;
    const next = withActivity("a", "Opera House");
    next.sections[0]!.proposal!.items.push({
      ...next.sections[0]!.proposal!.items[0]!,
      id: "second",
      detail: "Botanic Garden",
    });
    view.rerender(<Probe plan={next} />);
    await waitFor(() => expect(screen.getByTestId("markers").dataset.loading).toBe("false"));
    expect(screen.getByTestId("markers").textContent).toBe("Opera House");
  });
});
