import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";
import { CURRENT_KEY, SAVED_KEY } from "@/lib/workspace";
import { CATALOG_KEY, parseCatalog } from "@/lib/workspace/catalog";
import { plan, snapshot } from "@/tests/fixtures/workspace";
const planFor = (destination: string, activity = "Museum", tripId = plan.tripId) => ({
  ...plan,
  tripId,
  brief: { ...plan.brief, tripId, destination },
  sections: plan.sections.map((section) => ({
    ...section,
    proposal: section.proposal && {
      ...section.proposal,
      items: [{ kind: "activity" as const, detail: activity, estCost: 200 }],
    },
  })),
});
const complete = (destination: string, activity?: string) =>
  new Response(
    JSON.stringify({
      type: "complete",
      response: { reply: "Updated", plan: planFor(destination, activity) },
    }),
  );
/** A chat stream whose plan uses the trip ID the client sent. */
const completeFor = (destination: string) => (init?: RequestInit) => {
  const { tripId } = JSON.parse(init!.body as string);
  return new Response(
    JSON.stringify({
      type: "complete",
      response: { reply: "Updated", plan: planFor(destination, "Museum", tripId) },
    }),
  );
};
const louvre = {
  id: "place-louvre",
  displayName: { text: "Louvre" },
  location: { latitude: 48.86, longitude: 2.34 },
};
const drawer = (name: "trip" | "preferences") =>
  document.querySelector<HTMLElement>(`.workspace-drawer--${name}`)!;
const openPreferences = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open trip preferences" }));
const googlePlace = {
  id: "place-museum",
  displayName: { text: "Sydney museum" },
  formattedAddress: "Sydney NSW, Australia",
  location: { latitude: -33.8688, longitude: 151.2093 },
};
const sidebar = () => screen.getByRole("complementary", { name: "Chats and trips" });
/** Only the narrow layout puts the sidebar inside a drawer. */
const useNarrowLayout = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 1000px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
const historyButton = (name: RegExp) => within(sidebar()).getAllByRole("button", { name })[0]!;
const withPlaceRequests = (...responses: (Response | ((init?: RequestInit) => Response))[]) => {
  let next = 0;
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Asked once on mount to learn the deployment's mock/live default; it is
    // not part of any test's ordered response queue.
    if (url === "/api/data-mode")
      return Promise.resolve(
        Response.json({ configured: "mock", providers: { hotelsAndFlights: false, maps: false } }),
      );
    if (url === "/api/places/search")
      return Promise.resolve(Response.json({ places: [googlePlace] }));
    if (url === "/api/places/details")
      return Promise.resolve(Response.json({ place: googlePlace }));
    const response = responses[next++]!;
    return Promise.resolve(typeof response === "function" ? response(init) : response);
  });
};

describe("Workspace interactions", () => {
  it("opens the trip drawer over the map and removes it completely when closed", async () => {
    render(<Workspace initialPlan={plan} />);
    const trigger = screen.getByRole("button", { name: "Open your trip" });
    const map = document.querySelector(".workspace-panel--map")!;
    const trip = drawer("trip");
    expect(trip.getAttribute("aria-hidden")).toBe("true");
    expect(trip.hasAttribute("inert")).toBe(true);
    expect(map.contains(trip)).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trip.getAttribute("aria-hidden")).toBe("false");
    expect(trip.hasAttribute("inert")).toBe(false);
    expect(trip.getAttribute("aria-modal")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close your trip" }));
    // The drawer overlays the map; the map canvas stays mounted in its own column.
    expect(document.querySelector(".workspace-panel--map")).toBe(map);
    expect(within(trip).getByRole("button", { name: "Review plan" })).toBeTruthy();
    expect(within(trip).getByRole("button", { name: "Save trip" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(trip.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close open panel" }));
    expect(trip.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close your trip" }));
    expect(trip.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(trigger);
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      expect(catalog.layout.preferences.open).toBe(false);
      expect(catalog.layout.trip.open).toBe(false);
    });
  });
  it("keeps only one drawer open and returns focus from Preferences", () => {
    render(<Workspace initialPlan={plan} />);
    const preferences = drawer("preferences");
    const trip = drawer("trip");
    const preferencesTrigger = screen.getByRole("button", { name: "Open trip preferences" });
    fireEvent.click(preferencesTrigger);
    expect(preferences.getAttribute("aria-hidden")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Open your trip" }));
    expect(preferences.getAttribute("aria-hidden")).toBe("true");
    expect(trip.getAttribute("aria-hidden")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Open trip preferences" }));
    expect(trip.getAttribute("aria-hidden")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(preferences.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(preferencesTrigger);
    expect(document.querySelector(".workspace-drawer-backdrop")).toBeNull();
  });
  it("closes a drawer when its own topbar button is clicked again", () => {
    render(<Workspace initialPlan={plan} />);
    for (const [name, panel] of [
      ["Open trip preferences", "preferences"],
      ["Open your trip", "trip"],
    ] as const) {
      const trigger = screen.getByRole("button", { name });
      fireEvent.click(trigger);
      expect(drawer(panel).getAttribute("aria-hidden")).toBe("false");
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(trigger);
      expect(drawer(panel).getAttribute("aria-hidden")).toBe("true");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }
  });
  it("keeps the timeline and editors out of the map canvas", () => {
    render(<Workspace initialPlan={plan} />);
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    expect(within(map).queryByRole("button", { name: "Verify day routes" })).toBeNull();
    expect(within(map).queryByRole("button", { name: "Review plan" })).toBeNull();
    expect(within(map).queryByText(/Estimated total/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open your trip" }));
    fireEvent.click(screen.getByRole("tab", { name: "Timeline & routes" }));
    const trip = drawer("trip");
    expect(within(trip).getByRole("button", { name: "Verify day routes" })).toBeTruthy();
    expect(within(map).queryByRole("button", { name: "Verify day routes" })).toBeNull();
  });
  it("starts a blank conversation instead of carrying the demo trip into New chat", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "left over from Sydney" },
    });
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    const chat = document.querySelector<HTMLElement>(".workspace-panel--chat")!;
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    expect((screen.getByLabelText("Message AI Trip Planner") as HTMLInputElement).value).toBe("");
    // The blank state's example buttons name cities on purpose; what must not
    // survive New chat is the previous plan's own content.
    expect(within(within(chat).getByRole("log")).queryByText(/Sydney|Museum/)).toBeNull();
    expect(within(map).queryByText(/Sydney|Museum/)).toBeNull();
    expect(within(chat).getByText("Where to next?")).toBeTruthy();
    openPreferences();
    for (const label of [
      "Destination",
      "Start date",
      "End date",
      "Travellers",
      "Total budget (AUD)",
    ])
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Open your trip" }));
    expect(within(drawer("trip")).getByText(/No trip yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save trip" })).toBeNull();
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      const active = catalog.conversations.find(
        (conversation) => conversation.id === catalog.activeConversationId,
      );
      expect(active?.title).toBe("New chat");
      expect(active?.tripId).toBeUndefined();
      expect(active?.messages).toEqual([]);
      expect(catalog.activeTripId).toBeUndefined();
      expect(catalog.trips).toHaveLength(1);
      expect(catalog.conversations).toHaveLength(2);
    });
  });
  it("reuses the empty conversation instead of stacking one per New chat press", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    const newChat = screen.getByRole("button", { name: "New chat" });
    fireEvent.click(newChat);
    fireEvent.click(newChat);
    fireEvent.click(newChat);
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      expect(catalog.conversations).toHaveLength(2);
      const empty = catalog.conversations.filter((item) => item.title === "New chat");
      expect(empty).toHaveLength(1);
      // The reused conversation stays selected, so the next message belongs to it.
      expect(catalog.activeConversationId).toBe(empty[0]!.id);
    });
  });
  it("does not bring a blank chat back when the open one is deleted", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).conversations).toHaveLength(2),
    );
    const deleted = parseCatalog(localStorage.getItem(CATALOG_KEY)).activeConversationId;
    fireEvent.click(screen.getByRole("button", { name: "Actions for New chat" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    // Deleting the open chat opens a fresh blank one. That replacement must not be the record
    // just deleted: reusing its id used to put the deleted chat straight back on screen.
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      expect(catalog.conversations.map((item) => item.id)).not.toContain(deleted);
      expect(catalog.conversations.filter((item) => item.title === "New chat")).toHaveLength(1);
    });
  });
  it("does not add a second empty conversation when New chat follows a reload", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    const view = render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).conversations).toHaveLength(2),
    );
    view.unmount();
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      expect(catalog.conversations).toHaveLength(2);
      expect(catalog.conversations.filter((item) => item.title === "New chat")).toHaveLength(1);
    });
  });
  it("keeps the user's name when New chat reuses a renamed empty conversation", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Later ideas");
    fireEvent.click(screen.getByRole("button", { name: "Actions for New chat" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    prompt.mockRestore();
    await waitFor(() =>
      expect(
        parseCatalog(localStorage.getItem(CATALOG_KEY)).conversations.map((item) => item.title),
      ).toContain("Later ideas"),
    );
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      expect(catalog.conversations).toHaveLength(2);
      expect(catalog.conversations.map((item) => item.title)).toContain("Later ideas");
      expect(catalog.conversations.filter((item) => item.title === "New chat")).toHaveLength(0);
    });
  });
  it("keeps rename and delete behind a per-conversation overflow menu", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    // The actions are not on the row until the trigger opens them.
    expect(screen.queryByRole("menuitem")).toBeNull();
    const trigger = screen.getByRole("button", { name: /^Actions for / });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Rename",
      "Delete",
    ]);

    // Pressing the trigger again closes it instead of reopening.
    fireEvent.click(trigger);
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
  it("closes the overflow menu on Escape and returns focus to its trigger", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    const trigger = screen.getByRole("button", { name: /^Actions for / });
    fireEvent.click(trigger);
    // Opening moves focus into the menu so Escape and Tab act on it.
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("closes the overflow menu when the user clicks outside it", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Actions for / }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
  it("closes the menu on Escape without also closing the enclosing navigation drawer", async () => {
    useNarrowLayout();
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const nav = document.querySelector<HTMLElement>(".workspace-drawer--nav")!;
    await waitFor(() => expect(nav.getAttribute("aria-hidden")).toBe("false"));
    const trigger = screen.getByRole("button", { name: /^Actions for / });
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    // The menu closes, but the drawer the sidebar sits in stays open.
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(nav.getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
  it("offers no overflow menu on trips, which have no rename or delete", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Trips/ }));
    const sidebarSection = screen.getByRole("region", { name: "Trips" });
    expect(within(sidebarSection).queryByRole("button", { name: /^Actions for / })).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
  it("saves a blank conversation's form and input and restores it after reload", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    const view = render(<Workspace initialPlan={plan} />);
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    openPreferences();
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Lisbon" } });
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "somewhere warm" },
    });
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      const active = catalog.conversations.find((item) => item.id === catalog.activeConversationId);
      expect(active?.draft?.destination).toBe("Lisbon");
      expect(active?.input).toBe("somewhere warm");
    });
    view.unmount();
    render(<Workspace />);
    expect((screen.getByLabelText("Message AI Trip Planner") as HTMLInputElement).value).toBe(
      "somewhere warm",
    );
    openPreferences();
    expect((screen.getByLabelText("Destination") as HTMLInputElement).value).toBe("Lisbon");
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe("");
    expect(within(drawer("trip")).queryByText(/Sydney/)).toBeNull();
    // Scoped to the message log: the blank state's example buttons name cities
    // on purpose, so the chat panel as a whole is no longer a clean signal.
    expect(
      within(
        within(document.querySelector<HTMLElement>(".workspace-panel--chat")!).getByRole("log"),
      ).queryByText(/Sydney/),
    ).toBeNull();
    // Switching back to the earlier chat restores its own trip.
    fireEvent.click(historyButton(/^Sydney · 2026-10-01/));
    expect((screen.getByLabelText("Destination") as HTMLInputElement).value).toBe("Sydney");
  });
  it("sends the current plan with a chat message so a question need not rebuild it", async () => {
    const fetcher = withPlaceRequests(completeFor("Sydney"));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace initialPlan={plan} />);
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "东京11月天气怎么样？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Updated");
    const request = JSON.parse(
      (fetcher.mock.calls.find(([url]) => url === "/api/chat")![1] as RequestInit).body as string,
    );
    expect(request.mode).toBeUndefined();
    expect(request.brief).toMatchObject({ destination: plan.brief.destination });
    expect(request.plan).toMatchObject({ tripId: plan.tripId });
  });
  it("starts a blank chat from natural language and links the generated trip", async () => {
    const fetcher = withPlaceRequests(completeFor("Lisbon"));
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace initialPlan={plan} />);
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "Lisbon, 2026-11-02 to 2026-11-06, 2 people, budget $2400" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Updated");
    const request = JSON.parse(
      (fetcher.mock.calls.find(([url]) => url === "/api/chat")![1] as RequestInit).body as string,
    );
    // No mode: the assistant reads the message and decides. A blank chat has no
    // brief or plan to send, only what earlier turns stated.
    expect(request.mode).toBeUndefined();
    expect(request.brief).toBeUndefined();
    expect(request.plan).toBeUndefined();
    expect(request.known).toBeDefined();
    expect(request.tripId).not.toBe(plan.tripId);
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      const active = catalog.conversations.find((item) => item.id === catalog.activeConversationId);
      expect(active?.tripId).toBe(`trip:${request.tripId}`);
      expect(catalog.trips.map((trip) => trip.id)).toContain(`trip:${request.tripId}`);
      expect(catalog.activeTripId).toBe(`trip:${request.tripId}`);
    });
  });
  it("aborts an in-flight plan on New chat and never shows its late answer", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/chat"
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(Response.json({ places: [] })),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace initialPlan={plan} />);
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "Change to Tokyo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const call = fetcher.mock.calls.find(([url]) => url === "/api/chat") as unknown as [
      string,
      RequestInit,
    ];
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(call[1].signal!.aborted).toBe(true);
    await act(async () => {
      finish(complete("Tokyo"));
    });
    expect(screen.queryByText(/Tokyo/)).toBeNull();
    const input = screen.getByLabelText("Message AI Trip Planner") as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(input.value).toBe("");
  });
  it("lets chat planning run while map lookups are pending and drops stale places", async () => {
    let finishPlaces!: (response: Response) => void;
    let finishChat!: (response: Response) => void;
    const searches: string[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/places/search") {
        const body = JSON.parse(init!.body as string);
        if (body.destination) searches.push(`${body.text}@${body.destination}`);
        if (body.destination === "Sydney")
          return new Promise<Response>((resolve) => {
            finishPlaces = resolve;
          });
        return Promise.resolve(Response.json({ places: [louvre] }));
      }
      return new Promise<Response>((resolve) => {
        finishChat = resolve;
      });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace initialPlan={plan} />);
    await waitFor(() => expect(searches).toEqual(["Museum@Sydney"]));
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "Change to Paris" },
    });
    // A pending map lookup does not block the chat.
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await act(async () => {
      finishChat(complete("Paris", "Louvre"));
    });
    expect(await within(drawer("trip")).findByText(/Paris · 2026-10-01/)).toBeTruthy();
    await waitFor(() => expect(searches).toContain("Louvre@Paris"));
    await act(async () => {
      finishPlaces(Response.json({ places: [googlePlace] }));
    });
    const list = await screen.findByRole("list", { name: "Places shown on the map" });
    expect(within(list).getByText(/Louvre/)).toBeTruthy();
    expect(within(list).queryByText(/Sydney museum/)).toBeNull();
  });
  it("opens blank on first visit without requesting a demo plan", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    // The mount-time mock/live status probe is fine; a demo plan request is not.
    expect(fetcher.mock.calls.map(([url]) => String(url))).not.toContain("/api/chat");
    expect(screen.getByRole("heading", { name: "New trip" })).toBeTruthy();
    expect(screen.getByText(/Not planned yet/)).toBeTruthy();
    expect(screen.getByText("Where to next?")).toBeTruthy();
    expect(screen.getByText("Your map will appear here")).toBeTruthy();
    expect((screen.getByLabelText("Message AI Trip Planner") as HTMLInputElement).value).toBe("");
    expect(document.body.textContent).not.toMatch(/Tokyo|Kyoto/);
    openPreferences();
    for (const label of ["Destination", "Start date", "End date", "Travellers"])
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    await waitFor(() => {
      const catalog = parseCatalog(localStorage.getItem(CATALOG_KEY));
      expect(catalog.trips).toHaveLength(0);
      expect(catalog.conversations[0]?.title).toBe("New chat");
    });
  });
  it("does not reopen the last trip on refresh but restores it when chosen from history", async () => {
    vi.stubGlobal("fetch", withPlaceRequests());
    const view = render(<Workspace initialPlan={plan} />);
    openPreferences();
    fireEvent.change(screen.getByLabelText("Total budget (AUD)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "unfinished request" },
    });
    await waitFor(() =>
      expect(
        parseCatalog(localStorage.getItem(CATALOG_KEY)).conversations.some(
          (item) => item.input === "unfinished request",
        ),
      ).toBe(true),
    );
    view.unmount();
    render(<Workspace />);
    expect(screen.getByRole("heading", { name: "New trip" })).toBeTruthy();
    expect((screen.getByLabelText("Message AI Trip Planner") as HTMLInputElement).value).toBe("");
    expect(within(drawer("trip")).queryByText(/Sydney/)).toBeNull();
    fireEvent.click(historyButton(/^Sydney · 2026-10-01/));
    expect(screen.getByRole("heading", { name: "Sydney" })).toBeTruthy();
    expect((screen.getByLabelText("Message AI Trip Planner") as HTMLInputElement).value).toBe(
      "unfinished request",
    );
    openPreferences();
    expect((screen.getByLabelText("Total budget (AUD)") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /^Trips\s*1$/ }));
    expect(historyButton(/^Sydney · 2026-10-01/).getAttribute("aria-current")).toBe("true");
  });
  it("keeps the plan and draft on failure and retries the same structured request", async () => {
    const fetcher = withPlaceRequests(
      new Response('{"error":"Offline"}', { status: 503 }),
      complete("Paris"),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace initialPlan={plan} />);
    openPreferences();
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Paris" } });
    fireEvent.click(screen.getByRole("button", { name: "Update trip" }));
    await screen.findByText("Offline");
    expect((screen.getByLabelText("Destination") as HTMLInputElement).value).toBe("Paris");
    expect(within(drawer("trip")).getByText(/Sydney · 2026-10-01/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry update" }));
    await within(drawer("trip")).findByText(/Paris · 2026-10-01/);
    const chatCalls = fetcher.mock.calls.filter(([url]) => url === "/api/chat");
    const first = JSON.parse((chatCalls[0]![1] as RequestInit).body as string);
    expect(first.mode).toBe("plan");
    expect(first.brief.destination).toBe("Paris");
    expect((chatCalls[0]![1] as RequestInit).body).toBe((chatCalls[1]![1] as RequestInit).body);
  });
  it("restores saved data and ignores the result of the aborted old request", async () => {
    const restored = {
      ...snapshot,
      plan: { ...plan, brief: { ...plan.brief, destination: "Melbourne" } },
      draft: { ...snapshot.draft, destination: "Melbourne" },
    };
    localStorage.setItem(SAVED_KEY, JSON.stringify([restored]));
    let finish!: (response: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace initialPlan={plan} />);
    openPreferences();
    fireEvent.click(screen.getByRole("button", { name: "Update trip" }));
    fireEvent.click(screen.getByRole("button", { name: /^Saved trips/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restore trip" }));
    // Restoring leaves the preferences drawer open, and the topbar button is a toggle, so
    // re-opening it here would close it.
    await act(async () => {
      finish(complete("Obsolete result"));
    });
    expect((screen.getByLabelText("Destination") as HTMLInputElement).value).toBe("Melbourne");
    expect(screen.queryByText(/Obsolete result/)).toBeNull();
    expect(screen.getByRole("button", { name: "Update trip" }).hasAttribute("disabled")).toBe(
      false,
    );
  });
  it("keeps corrupt storage intact and tolerates quota failures", async () => {
    localStorage.setItem(CURRENT_KEY, "broken");
    render(<Workspace initialPlan={plan} />);
    expect(localStorage.getItem(CURRENT_KEY)).toBe("broken");
    expect(screen.getByRole("alert").textContent).toContain("could not be read");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry / replace workspace storage" }));
    expect(screen.getByRole("alert").textContent).toContain("unavailable or full");
    expect(within(drawer("trip")).getByText(/Sydney · 2026-10-01/)).toBeTruthy();
  });
});

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

describe("Workspace navigation", () => {
  it("collapses the sidebar to labelled icons, keeps focus and remembers the preference", async () => {
    const view = render(<Workspace />);
    // The blank conversation appears in Chats once autosave has recorded it.
    await waitFor(() =>
      expect(within(sidebar()).getByRole("button", { name: /^Chats\s*1$/ })).toBeTruthy(),
    );
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(sidebar()).getByText("AI Trip Planner")).toBeTruthy();
    expect(
      within(sidebar())
        .getByRole("button", { name: /^Chats\s*1$/ })
        .getAttribute("aria-current"),
    ).toBe("true");
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Expand sidebar");
    expect(document.activeElement).toBe(toggle);
    // Text and history details are gone; icon buttons stay reachable by name.
    expect(within(sidebar()).queryByText("AI Trip Planner")).toBeNull();
    expect(within(sidebar()).getByRole("img", { name: "AI Trip Planner" })).toBeTruthy();
    expect(within(sidebar()).queryByRole("region", { name: "Chats" })).toBeNull();
    expect(within(sidebar()).queryByRole("searchbox")).toBeNull();
    for (const name of [
      "New chat",
      "Search chats and trips",
      "Chats, 1",
      "Trips, 0",
      "Saved trips, 0",
    ]) {
      const button = within(sidebar()).getByRole("button", { name });
      expect(button.getAttribute("data-tooltip")).toBeTruthy();
    }
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).layout.sidebar.collapsed).toBe(true),
    );
    view.unmount();
    render(<Workspace />);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Search chats and trips" }));
    expect(document.activeElement).toBe(within(sidebar()).getByRole("searchbox"));
  });

  it("resizes the sidebar by dragging or keyboard, remembers it and resets on double-click", async () => {
    const view = render(<Workspace />);
    const app = () => document.querySelector<HTMLElement>(".workspace-app")!;
    const handle = () => screen.getByRole("separator", { name: "Resize sidebar" });
    // No stored width: the stylesheet's responsive default applies.
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("");

    // A click without movement must not pin a width.
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 240 });
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("");

    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 240 });
    expect(app().dataset.resizing).toBe("true");
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 331 });
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("331px");
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 900 });
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(app().dataset.resizing).toBeUndefined();
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("420px");
    expect(handle().getAttribute("aria-valuenow")).toBe("420");

    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("404px");
    fireEvent.keyDown(handle(), { key: "Home" });
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("200px");
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).layout.sidebar.width).toBe(200),
    );

    // Collapsed, there is no edge to drag; expanding restores the width.
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByRole("separator", { name: "Resize sidebar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    view.unmount();
    render(<Workspace />);
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("200px");

    fireEvent.doubleClick(handle());
    expect(app().style.getPropertyValue("--sidebar-width")).toBe("");
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).layout.sidebar.width).toBeUndefined(),
    );
  });
  it("reports the width actually rendered when no width is stored", async () => {
    render(<Workspace />);
    const handle = () => screen.getByRole("separator", { name: "Resize sidebar" });
    // jsdom does no layout, so the measured width falls back to the default to begin with.
    expect(handle().getAttribute("aria-valuenow")).toBe("240");
    const sidebar = document.querySelector<HTMLElement>(".workspace-sidebar")!;
    // Stand in for the stylesheet, which narrows the sidebar below 1250px.
    vi.spyOn(sidebar, "getBoundingClientRect").mockReturnValue({ width: 220 } as DOMRect);
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(handle().getAttribute("aria-valuenow")).toBe("220"));
  });
  it("does not pin a sidebar width when a click only drifts a pixel or two", async () => {
    render(<Workspace initialPlan={plan} />);
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).trips).toHaveLength(1),
    );
    const handle = () => screen.getByRole("separator", { name: "Resize sidebar" });
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 240 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 242 });
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(
      document
        .querySelector<HTMLElement>(".workspace-app")!
        .style.getPropertyValue("--sidebar-width"),
    ).toBe("");
    await waitFor(() =>
      expect(parseCatalog(localStorage.getItem(CATALOG_KEY)).layout.sidebar.width).toBeUndefined(),
    );
  });

  it("falls back safely when the stored layout is corrupt", () => {
    localStorage.setItem(
      CATALOG_KEY,
      JSON.stringify({
        version: 4,
        conversations: [],
        trips: [],
        layout: { sidebar: "yes", view: 7 },
      }),
    );
    render(<Workspace />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("puts Preferences and Trip in a top bar above the chat and map, with drawers below it", () => {
    render(<Workspace initialPlan={plan} />);
    const topbar = document.querySelector<HTMLElement>(".workspace-topbar")!;
    const shell = document.querySelector<HTMLElement>(".workspace-shell")!;
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    const actions = within(topbar).getAllByRole("button");
    expect(actions.at(-1)!.getAttribute("aria-label")).toBe("Open your trip");
    expect(within(topbar).getByRole("button", { name: "Open trip preferences" })).toBeTruthy();
    expect(
      within(map).queryByRole("button", { name: /Open (your trip|trip preferences)/ }),
    ).toBeNull();
    expect(within(topbar).getByRole("heading", { name: "Sydney" })).toBeTruthy();
    expect(topbar.textContent).toMatch(/4 days · 2 travellers · AUD\s2,000\.00 budget/);
    expect(shell.contains(topbar)).toBe(false);
    expect(shell.contains(drawer("trip"))).toBe(true);
    expect(shell.contains(drawer("preferences"))).toBe(true);
  });
});

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
    await waitFor(() => expect(bodies).toEqual([{ text: "Kyoto" }]));
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    await waitFor(() =>
      expect(within(map).getByText(/2 activities have no confirmed place yet/)).toBeTruthy(),
    );
    expect(map.querySelector(".trip-map-status")!.getAttribute("role")).toBe("status");
    expect(within(map).queryByText(/No Google place matched/)).toBeNull();
    expect(within(map).queryByRole("button", { name: "Retry places" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open your trip" }));
    fireEvent.click(screen.getByRole("tab", { name: "Timeline & routes" }));
    expect(within(drawer("trip")).getAllByText(/Location to be confirmed/).length).toBeGreaterThan(
      0,
    );
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
    const list = await screen.findByRole("list", { name: "Places shown on the map" });
    expect(within(list).getByText(/To-ji Temple/)).toBeTruthy();
    const map = document.querySelector<HTMLElement>(".workspace-panel--map")!;
    await waitFor(() =>
      expect(within(map).getByText(/1 could not be loaded from Google Places/)).toBeTruthy(),
    );
    expect(map.querySelector(".trip-map-status")!.getAttribute("role")).toBe("status");
    failGallery = false;
    searches.length = 0;
    fireEvent.click(within(map).getByRole("button", { name: "Retry places" }));
    await waitFor(() => expect(searches).toEqual(["Kyoto Gallery"]));
    await waitFor(() =>
      expect(within(map).getByText(/1 activity has no confirmed place yet/)).toBeTruthy(),
    );
    expect(
      within(screen.getByRole("list", { name: "Places shown on the map" })).getByText(
        /To-ji Temple/,
      ),
    ).toBeTruthy();
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
    expect(within(drawer("trip")).getByText(/Atlantis/)).toBeTruthy();
  });
});
