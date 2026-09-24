import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankDraft, draftFor, type Draft } from "@/lib/workspace";
import type { FactKey } from "@/lib/workspace/trip-facts";
import { TripFactChips } from "@/components/preferences/TripFactChips";
import { Workspace } from "@/components/workspace/Workspace";
import { plan } from "@/tests/fixtures/workspace";

// Pin "today" so which calendar days are enabled, and so their accessible names, stay fixed.
// shouldAdvanceTime keeps findBy* polling in real time while the picker is dynamic-imported.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 20)); // 2026-09-20
});
afterEach(() => vi.useRealTimers());

function Harness({
  initial = blankDraft(),
  withPlan = false,
  onSave = vi.fn(),
  onPlan = vi.fn(() => true),
  suggestPlaces = false,
}: {
  initial?: Draft;
  withPlan?: boolean;
  onSave?: (next: Draft) => void;
  onPlan?: (next: Draft) => boolean;
  suggestPlaces?: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [open, setOpen] = useState<FactKey>();
  const preferencesChip = useRef<HTMLButtonElement>(null);
  return (
    <TripFactChips
      draft={draft}
      plan={withPlan ? plan : undefined}
      busy={false}
      errors={{}}
      open={open}
      onOpen={setOpen}
      onClose={() => setOpen(undefined)}
      onSave={(next) => {
        setDraft(next);
        onSave(next);
      }}
      onPlan={(next) => {
        setDraft(next);
        return onPlan(next);
      }}
      preferencesChip={preferencesChip}
      suggestPlaces={suggestPlaces}
    />
  );
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("TripFactChips", () => {
  it("asks for each missing fact instead of showing a value", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Trip details" });
    const names = within(group)
      .getAllByRole("button")
      .map((item) => item.textContent);
    expect(names).toEqual(["Where", "When", "Who", "Budget", "Preferences"]);
    for (const item of within(group).getAllByRole("button")) {
      expect(item.getAttribute("aria-haspopup")).toBe("dialog");
      expect(item.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("names a filled chip by its fact, so the value is not announced alone", () => {
    render(<Harness initial={draftFor(plan.brief)} />);
    expect(button("Destination: Sydney")).toBeTruthy();
    expect(button("Dates: 1 Oct – 4 Oct · 4 days")).toBeTruthy();
    expect(button("Travellers: 2 travellers")).toBeTruthy();
    expect(button(/^Budget: AUD\s2,000$/)).toBeTruthy();
  });

  it("opens a labelled editor for one fact, focuses its field and returns focus on Escape", () => {
    render(<Harness />);
    const chip = button("Where");
    fireEvent.click(chip);
    const dialog = screen.getByRole("dialog", { name: "Where" });
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(chip.getAttribute("aria-controls")).toBe(dialog.id);
    // Where holds a list, so it opens centred as a modal dialog rather than under its chip.
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Add a destination"));
    // Only this fact's fields are in the editor.
    expect(within(dialog).queryByLabelText("Start date")).toBeNull();

    fireEvent.change(screen.getByLabelText("Add a destination"), { target: { value: "Lisbon" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(chip);
    // Escape discards the edit.
    expect(button("Where")).toBeTruthy();
  });

  it("keeps an edit only on Save, and saving without a plan never starts planning", () => {
    const onSave = vi.fn();
    const onPlan = vi.fn(() => true);
    render(<Harness onSave={onSave} onPlan={onPlan} />);
    fireEvent.click(button("Where"));
    // Text left in the search field counts, without pressing Enter first.
    fireEvent.change(screen.getByLabelText("Add a destination"), { target: { value: "Lisbon" } });
    fireEvent.change(screen.getByLabelText("Departing from (optional)"), {
      target: { value: "Sydney" },
    });
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Lisbon", origin: "Sydney", start: "" }),
    );
    expect(onPlan).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button("Destination: Lisbon"));
  });

  it("steps travellers with a stepper per kind and rejects an empty party", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(button("Who"));
    expect((button("Remove an adult") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button("Add an adult"));
    fireEvent.click(button("Add an adult"));
    fireEvent.click(button("Add a child"));
    expect(screen.getByLabelText("Adults: 2")).toBeTruthy();
    expect(screen.getByLabelText("Children: 1")).toBeTruthy();
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupSize: "3",
        party: { adults: 2, children: 1, infants: 0, seniors: 0, pets: 0 },
      }),
    );

    fireEvent.click(button("Budget"));
    fireEvent.change(screen.getByLabelText("Or enter an amount (AUD)"), {
      target: { value: "-5" },
    });
    fireEvent.click(button("Save"));
    expect(screen.getByRole("dialog", { name: "Budget" })).toBeTruthy();
    expect(screen.getByText("Enter a total budget above zero.")).toBeTruthy();
    expect(screen.getByLabelText("Or enter an amount (AUD)").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("fills the budget from a preset card, shown selected while the amount still matches it", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(button("Budget"));
    const group = screen.getByRole("radiogroup", { name: "Budget range" });
    const moderate = within(group).getByRole("radio", { name: /Moderate/ });
    expect(moderate.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(moderate);
    expect(moderate.getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Or enter an amount (AUD)") as HTMLInputElement).value).toBe(
      "3000",
    );
    // Typing a different amount deselects the preset.
    fireEvent.change(screen.getByLabelText("Or enter an amount (AUD)"), {
      target: { value: "3500" },
    });
    expect(moderate.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ budgetTotal: "3500" }));
  });

  it("with a plan, updates the trip through the planner and closes only when it was accepted", () => {
    const onPlan = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    render(<Harness initial={draftFor(plan.brief)} withPlan onPlan={onPlan} />);
    fireEvent.click(button("Destination: Sydney"));
    fireEvent.click(button("Remove Sydney"));
    fireEvent.change(screen.getByLabelText("Add a destination"), { target: { value: "Paris" } });
    fireEvent.click(button("Update trip"));
    expect(onPlan).toHaveBeenCalledWith(expect.objectContaining({ destination: "Paris" }));
    expect(screen.getByRole("dialog", { name: "Where" })).toBeTruthy();
    fireEvent.click(button("Update trip"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("holds the traveller's own preferences, not nationality or accommodation", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(button("Open trip preferences"));
    const dialog = screen.getByRole("dialog", { name: "Trip preferences" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    for (const retired of [/nationality/i, /room allocation/i, /guest rating/i, /cancellation/i])
      expect(within(dialog).queryByLabelText(retired)).toBeNull();

    const field = within(dialog).getByLabelText("Add a preference");
    expect(document.activeElement).toBe(field);
    const add = (text: string) => {
      fireEvent.change(field, { target: { value: text } });
      fireEvent.keyDown(field, { key: "Enter" });
    };
    add("Vegetarian food");
    add("  no   early starts ");
    add("Vegetarian food");
    expect(within(dialog).getByText("That preference is already on the list.")).toBeTruthy();
    fireEvent.change(field, { target: { value: "" } });
    const list = within(dialog).getByRole("list", { name: "Your preferences" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Vegetarian food", "no early starts"]);

    // Edit in place: Escape cancels only the edit, Enter keeps it.
    fireEvent.click(button("Edit “no early starts”"));
    const edit = screen.getByLabelText("Edit preference 2");
    expect(document.activeElement).toBe(edit);
    fireEvent.change(edit, { target: { value: "Nothing before 9am" } });
    fireEvent.keyDown(edit, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Trip preferences" })).toBeTruthy();
    expect(within(list).getByText("no early starts")).toBeTruthy();
    fireEvent.click(button("Edit “no early starts”"));
    fireEvent.change(screen.getByLabelText("Edit preference 2"), {
      target: { value: "Nothing before 9am" },
    });
    fireEvent.keyDown(screen.getByLabelText("Edit preference 2"), { key: "Enter" });
    expect(document.activeElement).toBe(button("Edit “Nothing before 9am”"));

    fireEvent.click(button("Remove “Vegetarian food”"));
    expect(document.activeElement).toBe(button("Edit “Nothing before 9am”"));
    // A typed but unadded preference is kept on Save too.
    fireEvent.change(field, { target: { value: "Quiet hotels" } });
    fireEvent.click(button("Done"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: ["Nothing before 9am", "Quiet hotels"] }),
    );
  });

  it("stops adding preferences at the most a trip keeps", () => {
    const full = Array.from({ length: 12 }, (_, index) => `Wish ${index + 1}`);
    render(<Harness initial={{ ...blankDraft(), preferences: full }} />);
    fireEvent.click(button("Open trip preferences"));
    expect(screen.getByLabelText("Add a preference")).toHaveProperty("disabled", true);
    expect(screen.getByText(/the most a trip keeps/)).toBeTruthy();
  });
});

describe("TripFactChips Where", () => {
  it("lists each destination, adds several at once and removes one from its row", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(button("Where"));
    const field = screen.getByLabelText("Add a destination");
    fireEvent.change(field, { target: { value: "Sydney & Melbourne" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.change(field, { target: { value: "hobart" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.change(field, { target: { value: "sydney" } });
    fireEvent.keyDown(field, { key: "Enter" });
    const list = screen.getByRole("list", { name: "Destinations" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Sydney", "Melbourne", "hobart"]);
    expect(document.activeElement).toBe(field);

    fireEvent.click(button("Remove Melbourne"));
    // Focus moves to the row that took its place.
    expect(document.activeElement).toBe(button("Remove hobart"));
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Sydney & hobart" }),
    );
  });

  it("folds an empty search field back into its button with Escape, keeping the editor open", () => {
    render(<Harness initial={draftFor(plan.brief)} />);
    fireEvent.click(button("Destination: Sydney"));
    // Where with places already listed starts focus on its own "Add destination" pill, not the chip.
    expect(document.activeElement).toBe(button("Add destination"));
    fireEvent.click(button("Add destination"));
    const field = screen.getByLabelText("Add a destination");
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Where" })).toBeTruthy();
    expect(document.activeElement).toBe(button("Add destination"));
  });

  it("clears the search field from the button inside it", () => {
    render(<Harness />);
    fireEvent.click(button("Where"));
    const field = screen.getByLabelText("Add a destination") as HTMLInputElement;
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    fireEvent.change(field, { target: { value: "Lisb" } });
    fireEvent.click(button("Clear"));
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
  });

  it("never looks places up unless suggestions are on", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<Harness />);
    fireEvent.click(button("Where"));
    fireEvent.change(screen.getByLabelText("Add a destination"), { target: { value: "Lisbon" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Add a destination").getAttribute("role")).toBeNull();
  });

  it("suggests places after three characters and a pause, and adds the one picked", async () => {
    const fetcher = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        Response.json({
          places: [
            { id: "p1", displayName: { text: "Lisbon" }, formattedAddress: "Lisbon, Portugal" },
            { id: "p2", displayName: { text: "Lisburn" }, formattedAddress: "Lisburn, UK" },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Harness suggestPlaces />);
    fireEvent.click(button("Where"));
    const field = screen.getByRole("combobox", { name: "Add a destination" });
    fireEvent.change(field, { target: { value: "Li" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "Lis" } });
    fireEvent.change(field, { target: { value: "Lisb" } });
    await vi.advanceTimersByTimeAsync(400);
    // Debounced: only the last query is sent.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({ text: "Lisb" });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "LisbonLisbon, Portugal",
      "LisburnLisburn, UK",
    ]);
    expect(field.getAttribute("aria-expanded")).toBe("true");

    // Escape closes the list, not the editor.
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("dialog", { name: "Where" })).toBeTruthy();

    fireEvent.change(field, { target: { value: "Lisbo" } });
    await vi.advanceTimersByTimeAsync(400);
    // The previous query's options stay visible until the new ones arrive, and new results reset
    // the highlight; wait for the second lookup to land before moving through the list.
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => expect(field.getAttribute("aria-expanded")).toBe("true"));
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(field.getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[0]!.id);
    fireEvent.keyDown(field, { key: "Enter" });
    const list = screen.getByRole("list", { name: "Destinations" });
    expect(within(list).getByText("Lisbon")).toBeTruthy();
    // A picked place shows the region line it came with.
    expect(within(list).getByText("Lisbon, Portugal")).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe("");
  });
});

describe("TripFactChips dates", () => {
  const openWhen = () => {
    render(<Harness />);
    fireEvent.click(button("When"));
  };
  // The first dynamic import of react-day-picker is slow under a full parallel run.
  const pickStart = () =>
    screen.findByRole("button", { name: "Tuesday, September 22nd, 2026" }, { timeout: 15000 });

  it("shows an inline calendar with a prompt, disables past dates, and a single click is a complete one-day range", async () => {
    openWhen();
    expect(screen.getByText("Choose your travel dates.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    const start = await pickStart();
    // Past dates are disabled; "today" is pinned to 2026-09-20.
    expect(
      (screen.getByRole("button", { name: "Saturday, September 19th, 2026" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(start);
    expect(screen.getByText(/22 Sept? – 22 Sept? · 1 day/)).toBeTruthy();
    expect(button("Clear")).toBeTruthy();
  });

  it("fills both dates from the inline calendar, shows the summary and a Clear action, and the chip changes only on Save", async () => {
    openWhen();
    fireEvent.click(await pickStart());
    fireEvent.click(button("Friday, September 25th, 2026"));
    expect(screen.getByText(/22 Sept? – 25 Sept? · 4 days/)).toBeTruthy();
    expect(button("Clear")).toBeTruthy();
    expect(button("When")).toBeTruthy();
    fireEvent.click(button("Save"));
    expect(button(/^Dates: 22 Sept? – 25 Sept? · 4 days$/)).toBeTruthy();
  });

  it("clears a picked range back to the prompt", async () => {
    openWhen();
    fireEvent.click(await pickStart());
    fireEvent.click(button("Friday, September 25th, 2026"));
    fireEvent.click(button("Clear"));
    expect(screen.getByText("Choose your travel dates.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  // Picking through the calendar always yields a complete range (even a single day), so a "half a
  // range" draft can only arise from data set another way — an imported or previously stored draft.
  it("asks for both dates when the draft holds only a start date", () => {
    render(<Harness initial={{ ...blankDraft(), start: "2026-10-01" }} />);
    fireEvent.click(button("When"));
    fireEvent.click(button("Save"));
    expect(screen.getByText("Choose both a start and an end date.")).toBeTruthy();
    expect(button("When")).toBeTruthy();
  });
});

describe("TripFactChips in the workspace", () => {
  it("sends the chips' facts with the next chat message, before any plan exists", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        String(input) === "/api/data-mode"
          ? Response.json({ configured: "mock", providers: {} })
          : new Response('{"error":"Offline"}', { status: 503 }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    fireEvent.click(button("Where"));
    fireEvent.change(screen.getByLabelText("Add a destination"), { target: { value: "Lisbon" } });
    fireEvent.click(button("Save"));
    fireEvent.click(button("Open trip preferences"));
    fireEvent.change(screen.getByLabelText("Add a preference"), {
      target: { value: "Vegetarian food" },
    });
    fireEvent.click(button("Done"));
    fireEvent.click(button("Who"));
    fireEvent.click(button("Add an adult"));
    fireEvent.click(button("Add an adult"));
    fireEvent.click(button("Add an adult"));
    fireEvent.click(button("Save"));
    fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), {
      target: { value: "somewhere warm" },
    });
    fireEvent.click(button("Send"));
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/chat")).toBe(true),
    );
    const [, init] = fetcher.mock.calls.find(([url]) => String(url) === "/api/chat")!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.known).toEqual({
      destination: "Lisbon",
      groupSize: 3,
      // The Who steppers' breakdown travels with the head count.
      party: { adults: 3, children: 0, infants: 0, seniors: 0, pets: 0 },
      preferences: ["Vegetarian food"],
    });
    expect(body.mode).toBeUndefined();
  });

  it("opens the first missing fact from the blank chat's Add trip details", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ configured: "mock" }))),
    );
    render(<Workspace />);
    const chat = document.querySelector<HTMLElement>(".workspace-panel--chat")!;
    fireEvent.click(within(chat).getByRole("button", { name: "Add trip details" }));
    expect(screen.getByRole("dialog", { name: "Where" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Add a destination"));
  });

  it("opens the fact a rejected Plan trip points at, without sending anything", () => {
    const fetcher = vi.fn((_input: RequestInfo | URL) =>
      Promise.resolve(Response.json({ configured: "mock" })),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Workspace />);
    fireEvent.click(button("Open trip preferences"));
    fireEvent.click(button("Plan trip"));
    const where = screen.getByRole("dialog", { name: "Where" });
    expect(within(where).getByText("Enter a destination.")).toBeTruthy();
    expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/chat")).toBe(false);
  });
});
