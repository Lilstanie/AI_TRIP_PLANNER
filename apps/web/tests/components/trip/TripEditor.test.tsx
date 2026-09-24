import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TripEditor } from "@/components/trip/TripEditor";
import type { TripPlaces } from "@/components/map/useTripPlaces";
import { plan as seed } from "@/tests/fixtures/workspace";
import { identifyActivities, itineraryActivities } from "@/lib/workspace";
import { TripPlan } from "@trip/shared";
function fixture() {
  const plan = identifyActivities(structuredClone(seed));
  Object.assign(plan.sections[0]!.proposal!.items[0]!, {
    day: 1,
    startTime: "09:00",
    endTime: "10:00",
  });
  return plan;
}
const places = (plan: TripPlan): TripPlaces => ({
  activities: itineraryActivities(plan),
  markers: [],
  places: {},
  loading: false,
  destinations: [],
  destinationsSettled: true,
  destinationsUnavailable: false,
  unconfirmed: 0,
  unavailable: 0,
  locationStatus: () => "unconfirmed",
  placeIdFor: (activity) => activity.placeId,
  activityForPlace: () => undefined,
  rememberPlace: vi.fn(),
  retry: vi.fn(),
});
const response = (plan: TripPlan) =>
  new Response(
    JSON.stringify({
      plan: { ...plan, editVersion: 1 },
      baseVersion: 0,
      routes: [],
      differences: ["Time changed"],
      blockers: [],
    }),
  );
describe("editor request lifecycle", () => {
  it("renders the timeline only, without an embedded map", () => {
    const plan = fixture();
    render(
      <TripEditor
        plan={plan}
        disabled={false}
        onApply={vi.fn()}
        onPending={vi.fn()}
        tripPlaces={places(plan)}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Verify day routes" })).toBeTruthy();
    expect(screen.queryByLabelText("Google activity map")).toBeNull();
  });
  it("shares activity selection with the map", () => {
    const plan = fixture();
    const select = vi.fn();
    render(
      <TripEditor
        plan={plan}
        disabled={false}
        onApply={vi.fn()}
        onPending={vi.fn()}
        tripPlaces={places(plan)}
        onSelect={select}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /09:00–10:00 · Museum/ }));
    expect(select).toHaveBeenCalledWith(itineraryActivities(plan)[0]!.id);
  });
  it("discards a late preview after workspace restore", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const original = fixture(),
      apply = vi.fn(),
      pending = vi.fn();
    const { rerender } = render(
      <TripEditor
        plan={original}
        disabled={false}
        onApply={apply}
        onPending={pending}
        tripPlaces={places(original)}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview time" }));
    const restored = { ...original, tripId: "restored" };
    rerender(
      <TripEditor
        plan={restored}
        disabled={false}
        onApply={apply}
        onPending={pending}
        tripPlaces={places(restored)}
        onSelect={vi.fn()}
      />,
    );
    finish(response(original));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Apply changes" })).toBeNull());
    expect(apply).not.toHaveBeenCalled();
  });
  it("Escape cancels only the preview and restores keyboard focus", async () => {
    const plan = fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(plan)),
    );
    const outer = vi.fn();
    window.addEventListener("keydown", outer);
    render(
      <TripEditor
        plan={plan}
        disabled={false}
        onApply={vi.fn()}
        onPending={vi.fn()}
        tripPlaces={places(plan)}
        onSelect={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Preview time" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("button", { name: "Apply changes" });
    const region = screen.getByRole("region", { name: "Edit preview" });
    // Focus moves in an effect after the preview commits; on a slow runner the button can appear
    // before that effect has run, so wait for focus rather than asserting it on the same tick.
    await waitFor(() => expect(document.activeElement).toBe(region));
    fireEvent.keyDown(region, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Apply changes" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(outer).not.toHaveBeenCalled();
    window.removeEventListener("keydown", outer);
  });
});
