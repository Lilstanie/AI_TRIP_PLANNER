import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "@/components/preferences/DateRangePicker";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 20));
});
afterEach(() => vi.useRealTimers());

describe("DateRangePicker", () => {
  it("renders as a modal dialog with the confirm action disabled until a full range is picked", () => {
    render(<DateRangePicker onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /when are you travelling/i })).toBeTruthy();
    const confirm = screen.getByRole("button", { name: /use these dates/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("disables every day before today, so a trip can't be planned into the past", () => {
    render(<DateRangePicker onConfirm={vi.fn()} onClose={vi.fn()} />);

    const yesterday = screen.getByRole("button", {
      name: "Saturday, September 19th, 2026",
    }) as HTMLButtonElement;
    const today = screen.getByRole("button", {
      name: "Today, Sunday, September 20th, 2026",
    }) as HTMLButtonElement;
    expect(yesterday.disabled).toBe(true);
    expect(today.disabled).toBe(false);
  });

  it("fills in the confirm action once a full range is clicked, formatted for the chat parser", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<DateRangePicker onConfirm={onConfirm} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Tuesday, September 22nd, 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Friday, September 25th, 2026" }));
    const confirm = screen.getByRole("button", { name: /use these dates/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({ start: "2026-09-22", end: "2026-09-25" });
    expect(onClose).toHaveBeenCalled();
  });

  it("orders the two clicks chronologically even if the second click lands before the first", () => {
    const onConfirm = vi.fn();
    render(<DateRangePicker onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Friday, September 25th, 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, September 22nd, 2026" }));
    fireEvent.click(screen.getByRole("button", { name: /use these dates/i }));

    expect(onConfirm).toHaveBeenCalledWith({ start: "2026-09-22", end: "2026-09-25" });
  });

  it("calls onClose without onConfirm when cancelled", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<DateRangePicker onConfirm={onConfirm} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
