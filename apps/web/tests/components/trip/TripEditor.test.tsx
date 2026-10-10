import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { type ComponentProps } from "react";
import { TripEditor } from "@/components/trip/TripEditor";
import { usePlanRevision } from "@/components/trip/plan-revision";
import type { TripPlaces } from "@/components/map/useTripPlaces";
import { plan as seed } from "@/tests/fixtures/workspace";
import { identifyActivities, itineraryActivities } from "@/lib/workspace";
import { TripPlan } from "@trip/shared";
import { buildItinerary } from "@/lib/trip/itinerary";

function Editor(props: Omit<ComponentProps<typeof TripEditor>, "revisions">) {
  const revisions = usePlanRevision({
    plan: props.plan,
    held: props.disabled,
    dataMode: undefined,
    onApply: props.onApply,
  });
  return <TripEditor {...props} revisions={revisions} />;
}

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
  itinerary: buildItinerary(plan, () => undefined),
  places: {},
  loading: false,
  destinations: [],
  destinationsSettled: true,
  destinationsUnavailable: false,
  unconfirmed: 0,
  unavailable: 0,
  locationStatus: () => "unconfirmed",
  placeIdFor: (activity) => activity.placeId,
  rememberPlace: vi.fn(),
  retry: vi.fn(),
});
const response = (plan: TripPlan) =>
  new Response(
    JSON.stringify({
      plan: { ...plan, editVersion: 1 },
      baseVersion: 0,
      routes: [],
      differences: [
        { stop: "Museum", before: "10:00–11:00", after: "11:00–12:00", placeChanged: false },
      ],
      blockers: [],
      blockerNotices: [],
    }),
  );
describe("editor request lifecycle", () => {
  it("renders the timeline only, without an embedded map", () => {
    const plan = fixture();
    render(
      <Editor
        plan={plan}
        disabled={false}
        onApply={vi.fn()}
        onPending={vi.fn()}
        tripPlaces={places(plan)}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Check routes/ })).toBeNull();
    expect(screen.queryByRole("group", { name: "Travel between stops by" })).toBeNull();
    expect(screen.queryByLabelText("Google activity map")).toBeNull();
  });
  it("shares activity selection with the map", () => {
    const plan = fixture();
    const select = vi.fn();
    render(
      <Editor
        plan={plan}
        disabled={false}
        onApply={vi.fn()}
        onPending={vi.fn()}
        tripPlaces={places(plan)}
        onSelect={select}
      />,
    );
    fireEvent.click(document.querySelector<HTMLElement>(".timeline-stop__main")!);
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
      <Editor
        plan={original}
        disabled={false}
        onApply={apply}
        onPending={pending}
        tripPlaces={places(original)}
        selected={itineraryActivities(original)[0]!.id}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Change time, / }));
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "10:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Change time" }));
    const restored = { ...original, tripId: "restored" };
    rerender(
      <Editor
        plan={restored}
        disabled={false}
        onApply={apply}
        onPending={pending}
        tripPlaces={places(restored)}
        selected={itineraryActivities(restored)[0]!.id}
        onSelect={vi.fn()}
      />,
    );
    finish(response(original));
    await waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
    expect(apply).not.toHaveBeenCalled();
  });
});
