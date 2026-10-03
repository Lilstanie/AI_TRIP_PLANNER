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

function completeAddressFields() {
  if (!screen.queryByRole("dialog", { name: "Where" })) return;
  const country = within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText(
    "Country *",
  );
  fireEvent.change(country, { target: { value: "Portugal" } });
  const origin = screen.getByRole("group", { name: "Departing from" });
  const city = within(origin).getByLabelText("City *") as HTMLInputElement;
  if (!city.value) fireEvent.change(city, { target: { value: "Sydney" } });
  fireEvent.change(within(origin).getByLabelText("Country *"), { target: { value: "Australia" } });
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("TripFactChips", () => {
  it("stops all people additions at nine while pets have their own three-pet limit", () => {
    render(
      <Harness
        initial={{
          ...blankDraft(),
          groupSize: "9",
          party: {
            adults: 4,
            children: 2,
            infants: 1,
            seniors: 2,
            pets: 2,
          },
        }}
      />,
    );
    fireEvent.click(button(/^Travellers:/));
    for (const name of ["Add an adult", "Add a child", "Add an infant", "Add a senior"])
      expect((button(name) as HTMLButtonElement).disabled).toBe(true);
    expect((button("Add a pet") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button("Add a pet"));
    expect((button("Add a pet") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button("Remove a child"));
    expect((button("Add an adult") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button("Add an adult"));
    expect((button("Add an adult") as HTMLButtonElement).disabled).toBe(true);
    completeAddressFields();
    fireEvent.click(button("Save"));
    expect(button(/^Travellers:/).textContent).toContain("5 adults");
    expect(button(/^Travellers:/).textContent).toContain("3 pets");
  });
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
    expect(document.activeElement).toBe(
      within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText("City *"),
    );
    // Only this fact's fields are in the editor.
    expect(within(dialog).queryByLabelText("Start date")).toBeNull();

    fireEvent.change(
      within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText("City *"),
      { target: { value: "Lisbon" } },
    );
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
    fireEvent.change(
      within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText("City *"),
      { target: { value: "Lisbon" } },
    );
    fireEvent.change(
      within(screen.getByRole("group", { name: "Departing from" })).getByLabelText("City *"),
      {
        target: { value: "Sydney" },
      },
    );
    completeAddressFields();
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "Lisbon, Portugal",
        origin: "Sydney, Australia",
        start: "",
      }),
    );
    expect(onPlan).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button("Destination: Lisbon, Portugal"));
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
    completeAddressFields();
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
    completeAddressFields();
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
    completeAddressFields();
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ budgetTotal: "3500" }));
  });

  it("with a plan, updates the trip through the planner and closes only when it was accepted", () => {
    const onPlan = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    render(<Harness initial={draftFor(plan.brief)} withPlan onPlan={onPlan} />);
    fireEvent.click(button("Destination: Sydney"));
    fireEvent.change(
      within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText("City *"),
      { target: { value: "Paris" } },
    );
    completeAddressFields();
    fireEvent.click(button("Update trip"));
    expect(onPlan).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Paris, Portugal" }),
    );
    expect(screen.getByRole("dialog", { name: "Where" })).toBeTruthy();
    completeAddressFields();
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
  it("never looks places up while entering manual addresses, even in live suggestion mode", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<Harness suggestPlaces />);
    fireEvent.click(button("Where"));
    const group = screen.getByRole("group", { name: "Destination 1" });
    fireEvent.change(within(group).getByLabelText("City *"), { target: { value: "Sydney" } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("adds another structured destination and removes it without losing the first", () => {
    render(<Harness />);
    fireEvent.click(button("Where"));
    const first = screen.getByRole("group", { name: "Destination 1" });
    fireEvent.change(within(first).getByLabelText("City *"), { target: { value: "Sydney" } });
    fireEvent.click(button("Add destination"));
    expect(screen.getByRole("group", { name: "Destination 2" })).toBeTruthy();
    fireEvent.click(button("Remove destination 2"));
    expect(screen.queryByRole("group", { name: "Destination 2" })).toBeNull();
    expect((within(first).getByLabelText("City *") as HTMLInputElement).value).toBe("Sydney");
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
    completeAddressFields();
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
    completeAddressFields();
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
    fireEvent.change(
      within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText("City *"),
      { target: { value: "Lisbon" } },
    );
    completeAddressFields();
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
    completeAddressFields();
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
    expect(body.known).toMatchObject({
      destination: "Lisbon, Portugal",
      origin: "Sydney, Australia",
      locations: {
        destinations: [{ city: "Lisbon", country: "Portugal" }],
        origin: { city: "Sydney", country: "Australia" },
      },
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
    expect(document.activeElement).toBe(
      within(screen.getByRole("group", { name: "Destination 1" })).getByLabelText("City *"),
    );
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
