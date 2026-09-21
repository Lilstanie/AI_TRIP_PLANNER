import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankDraft } from "@/lib/workspace";
import { FiltersPanel } from "@/components/preferences/FiltersPanel";

// Pin "today" so which calendar days are enabled/disabled — and which
// accessible names exist to click — doesn't drift as real time passes.
// shouldAdvanceTime keeps setTimeout-based polling (screen.findByRole,
// waitFor — used below because the picker is dynamic-imported) actually
// progressing in real time; without it those hang until Vitest's own
// unrelated test-level timeout, not a useful failure to debug from.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 20)); // 2026-09-20
});
afterEach(() => vi.useRealTimers());

function renderPanel() {
  const onChange = vi.fn();
  render(
    <FiltersPanel
      draft={blankDraft()}
      onChange={onChange}
      onSubmit={vi.fn()}
      busy={false}
      errors={{}}
    />,
  );
  return { onChange };
}

describe("FiltersPanel dates", () => {
  it("still exposes plain type=date inputs for typing dates by hand", () => {
    renderPanel();

    expect(screen.getByLabelText("Start date")).toHaveProperty("type", "date");
    expect(screen.getByLabelText("End date")).toHaveProperty("type", "date");
  });

  it("opens the same calendar picker used in chat from a dedicated button", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /pick trip dates from a calendar/i }));

    // First test to trigger next/dynamic's import of DateRangePicker (react-day-picker plus its
    // stylesheet). That cold transform takes ~3.5s here, which is close enough to the 5s default
    // poll to fail whenever the suite runs alongside everything else — so it gets its own budget.
    expect(
      await screen.findByRole("heading", { name: /when are you travelling/i }, { timeout: 15000 }),
    ).toBeTruthy();
  });

  it("sets both start and end on the draft at once when a range is confirmed", async () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /pick trip dates from a calendar/i }));
    await screen.findByRole("heading", { name: /when are you travelling/i });

    fireEvent.click(screen.getByRole("button", { name: "Tuesday, September 22nd, 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Friday, September 25th, 2026" }));
    fireEvent.click(screen.getByRole("button", { name: /use these dates/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ start: "2026-09-22", end: "2026-09-25" }),
    );
  });

  it("closes without changing the draft when cancelled", async () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /pick trip dates from a calendar/i }));
    await screen.findByRole("heading", { name: /when are you travelling/i });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /when are you travelling/i })).toBeNull();
  });
});
