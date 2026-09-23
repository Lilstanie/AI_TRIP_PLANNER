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
}: {
  initial?: Draft;
  withPlan?: boolean;
  onSave?: (next: Draft) => void;
  onPlan?: (next: Draft) => boolean;
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
    expect(names).toEqual([
      "Add destination",
      "Add dates",
      "Add travellers",
      "Add budget",
      "Preferences",
    ]);
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
    const chip = button("Add destination");
    fireEvent.click(chip);
    const dialog = screen.getByRole("dialog", { name: "Where" });
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(chip.getAttribute("aria-controls")).toBe(dialog.id);
    expect(document.activeElement).toBe(screen.getByLabelText("Destination"));
    // Only this fact's fields are in the editor.
    expect(within(dialog).queryByLabelText("Start date")).toBeNull();

    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Lisbon" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(chip);
    // Escape discards the edit.
    expect(button("Add destination")).toBeTruthy();
  });

  it("keeps an edit only on Save, and saving without a plan never starts planning", () => {
    const onSave = vi.fn();
    const onPlan = vi.fn(() => true);
    render(<Harness onSave={onSave} onPlan={onPlan} />);
    fireEvent.click(button("Add destination"));
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Lisbon" } });
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

  it("steps travellers and rejects a value the planner would reject", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(button("Add travellers"));
    expect((button("Remove a traveller") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button("Add a traveller"));
    fireEvent.click(button("Add a traveller"));
    expect((screen.getByLabelText("Travellers") as HTMLInputElement).value).toBe("2");
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ groupSize: "2" }));

    fireEvent.click(button("Add budget"));
    fireEvent.change(screen.getByLabelText("Total budget (AUD)"), { target: { value: "-5" } });
    fireEvent.click(button("Save"));
    expect(screen.getByRole("dialog", { name: "Budget" })).toBeTruthy();
    expect(screen.getByText("Enter a total budget above zero.")).toBeTruthy();
    expect(screen.getByLabelText("Total budget (AUD)").getAttribute("aria-invalid")).toBe("true");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("with a plan, updates the trip through the planner and closes only when it was accepted", () => {
    const onPlan = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    render(<Harness initial={draftFor(plan.brief)} withPlan onPlan={onPlan} />);
    fireEvent.click(button("Destination: Sydney"));
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Paris" } });
    fireEvent.click(button("Update trip"));
    expect(onPlan).toHaveBeenCalledWith(expect.objectContaining({ destination: "Paris" }));
    expect(screen.getByRole("dialog", { name: "Where" })).toBeTruthy();
    fireEvent.click(button("Update trip"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("holds nationality and accommodation in Preferences", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(button("Open trip preferences"));
    const dialog = screen.getByRole("dialog", { name: "Trip preferences" });
    fireEvent.change(within(dialog).getByLabelText("Nationality / passport (optional)"), {
      target: { value: "Australian" },
    });
    fireEvent.change(within(dialog).getByLabelText("Room allocation"), {
      target: { value: "individual" },
    });
    fireEvent.change(within(dialog).getByLabelText("Minimum guest rating (out of 10)"), {
      target: { value: "8" },
    });
    fireEvent.click(within(dialog).getByLabelText("Free cancellation required"));
    fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        nationality: "Australian",
        roomAllocation: "individual",
        minRating: "8",
        freeCancellation: true,
      }),
    );
  });
});

describe("TripFactChips dates", () => {
  const openWhen = () => {
    render(<Harness />);
    fireEvent.click(button("Add dates"));
  };

  it("keeps plain date inputs for typing dates by hand", () => {
    openWhen();
    expect(screen.getByLabelText("Start date")).toHaveProperty("type", "date");
    expect(screen.getByLabelText("End date")).toHaveProperty("type", "date");
  });

  it("fills both dates from the calendar, and the chip changes only on Save", async () => {
    openWhen();
    fireEvent.click(button(/pick trip dates from a calendar/i));
    // The first dynamic import of react-day-picker is slow under a full parallel run.
    await screen.findByRole("heading", { name: /when are you travelling/i }, { timeout: 15000 });
    fireEvent.click(button("Tuesday, September 22nd, 2026"));
    fireEvent.click(button("Friday, September 25th, 2026"));
    fireEvent.click(button(/use these dates/i));
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe("2026-09-22");
    expect((screen.getByLabelText("End date") as HTMLInputElement).value).toBe("2026-09-25");
    expect(button("Add dates")).toBeTruthy();
    fireEvent.click(button("Save"));
    expect(button(/^Dates: 22 Sept? – 25 Sept? · 4 days$/)).toBeTruthy();
  });

  it("closes only the calendar on Escape while it is open", async () => {
    openWhen();
    fireEvent.click(button(/pick trip dates from a calendar/i));
    const heading = await screen.findByRole("heading", { name: /when are you travelling/i });
    const calendar = heading.closest("dialog")!;
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "When" })).toBeTruthy();
    // The native dialog closes itself through its cancel event.
    fireEvent(calendar, new Event("cancel"));
    await waitFor(() => expect(document.querySelector("dialog[open]")).toBeNull());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "When" })).toBeNull();
  });

  it("asks for both dates rather than keeping half a range", () => {
    openWhen();
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
    fireEvent.click(button("Save"));
    expect(screen.getByText("Choose both a start and an end date.")).toBeTruthy();
    expect(button("Add dates")).toBeTruthy();
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
    fireEvent.click(button("Add destination"));
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Lisbon" } });
    fireEvent.click(button("Save"));
    fireEvent.click(button("Add travellers"));
    fireEvent.change(screen.getByLabelText("Travellers"), { target: { value: "3" } });
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
    expect(body.known).toEqual({ destination: "Lisbon", groupSize: 3 });
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
    expect(document.activeElement).toBe(screen.getByLabelText("Destination"));
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
