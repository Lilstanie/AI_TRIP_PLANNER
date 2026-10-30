import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";
import { plan } from "@/tests/fixtures/workspace";

const drawer = () =>
  document.querySelector<HTMLElement>(".trip-workspace__timeline") ??
  document.querySelector<HTMLElement>(".workspace-panel--trip")!;
const planWith = (
  items: { detail: string; location?: string; placeId?: string }[],
  destination = "Kyoto",
) =>
  ({
    ...plan,
    brief: { ...plan.brief, destination },
    sections: plan.sections.map((section) => ({
      ...section,
      proposal: section.proposal && {
        ...section.proposal,
        items: items.map((item) => ({ kind: "activity", day: 1, estCost: 10, ...item })),
      },
    })),
  }) as typeof plan;
const kyoto = {
  id: "city-kyoto",
  displayName: { text: "Kyoto" },
  location: { latitude: 35.01, longitude: 135.77 },
};
const toji = {
  id: "place-toji",
  displayName: { text: "To-ji Temple" },
  location: { latitude: 34.98, longitude: 135.75 },
};

describe("Workspace map places", () => {
  it("never sends descriptive activity text to Places and centres on the destination city", async () => {
    const bodies: Record<string, string>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(init!.body as string));
        return Response.json({ places: [kyoto] });
      }),
    );
    render(
      <Workspace
        initialPlan={planWith([
          {
            detail:
              "Arrival-day orientation walk at the single grounded candidate; low-key start to settle in.",
          },
          {
            detail: "Morning visit at the grounded candidate place.",
            location: "Mock attraction near Kyoto",
          },
        ])}
      />,
    );
    await waitFor(() => expect(bodies).toEqual([{ text: "Kyoto", language: "en" }]));
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    await waitFor(() =>
      expect(within(map).getByText(/2 activities have no confirmed place yet/)).toBeTruthy(),
    );
    expect(map.querySelector(".trip-map-status")!.getAttribute("role")).toBe("status");
    expect(within(map).queryByText(/No Google place matched/)).toBeNull();
    expect(within(map).queryByRole("button", { name: "Retry places" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open your trip" }));
    expect(within(drawer()).getAllByText(/Not found on the map/).length).toBeGreaterThan(0);
  });

  it("keeps located places when another lookup fails and retries only the failed one", async () => {
    const searches: string[] = [];
    let failGallery = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const { text } = JSON.parse(init!.body as string);
        searches.push(text);
        if (text === "Kyoto") return Response.json({ places: [kyoto] });
        if (text === "To-ji Temple") return Response.json({ places: [toji] });
        if (failGallery) return Response.json({ error: "busy" }, { status: 429 });
        return Response.json({ places: [] });
      }),
    );
    render(
      <Workspace
        initialPlan={planWith([
          { detail: "Temple morning", location: "To-ji Temple" },
          { detail: "Gallery afternoon", location: "Kyoto Gallery" },
        ])}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open your trip" }));
    const places = () => within(drawer()).getByRole("list", { name: "Day 1 timeline" });
    await waitFor(() =>
      expect(
        within(places()).getByRole("button", { name: /^Stop \d+: To-ji Temple/ }),
      ).toBeTruthy(),
    );
    const map = document.querySelector<HTMLElement>(".trip-workspace__map")!;
    await waitFor(() =>
      expect(within(map).getByText(/1 could not be loaded from the map service/)).toBeTruthy(),
    );
    expect(map.querySelector(".trip-map-status")!.getAttribute("role")).toBe("status");
    failGallery = false;
    searches.length = 0;
    fireEvent.click(within(map).getByRole("button", { name: "Retry places" }));
    await waitFor(() => expect(searches).toEqual(["Kyoto Gallery"]));
    await waitFor(() =>
      expect(within(map).getByText(/1 activity has no confirmed place yet/)).toBeTruthy(),
    );
    expect(within(places()).getByRole("button", { name: /^Stop \d+: To-ji Temple/ })).toBeTruthy();

    expect(within(places()).getAllByText(/Gallery afternoon|Kyoto Gallery/).length).toBeGreaterThan(
      0,
    );
  });

  it("shows a neutral placeholder instead of a world map when the destination cannot be located", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "down" }, { status: 502 })),
    );
    render(<Workspace initialPlan={planWith([{ detail: "Free time" }], "Atlantis")} />);
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    expect(await within(map).findByText("Atlantis could not be shown on the map yet")).toBeTruthy();
    expect(within(map).getByText(/temporarily unavailable. Your plan is unchanged/)).toBeTruthy();
    expect(within(map).queryByLabelText("Google activity map")).toBeNull();
    expect(document.title).toMatch(/^Atlantis/);
  });
});
