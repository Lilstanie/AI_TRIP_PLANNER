import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { HitlCheckpoint, TripPlan } from "@trip/shared";
import { CheckpointCards } from "@/components/trip/CheckpointCards";
import { plan } from "@/tests/fixtures/workspace";

const checkpoint = (over: Partial<HitlCheckpoint>): HitlCheckpoint => ({
  id: "c1",
  type: "confirm_brief",
  title: "Confirm the brief",
  detail: "Check the trip facts.",
  status: "pending",
  ...over,
});
const planWith = (hitl: HitlCheckpoint[]): TripPlan => ({ ...plan, hitl });

describe("CheckpointCards", () => {
  it("hides a checkpoint once it is approved", () => {
    const { rerender } = render(
      <CheckpointCards
        plan={planWith([checkpoint({})])}
        busy={false}
        onDecision={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Confirm the brief")).toBeTruthy();
    rerender(
      <CheckpointCards
        plan={planWith([checkpoint({ status: "approved" })])}
        busy={false}
        onDecision={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.queryByText("Confirm the brief")).toBeNull();
  });

  it("keeps an approved stay choice on screen so the hotel can still be changed", () => {
    render(
      <CheckpointCards
        plan={planWith([
          checkpoint({
            id: "stay",
            type: "select_stay",
            title: "Pick a hotel",
            status: "approved",
          }),
        ])}
        busy={false}
        onDecision={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Pick a hotel")).toBeTruthy();
  });

  it("still blocks confirm_plan while another decision is outstanding", () => {
    render(
      <CheckpointCards
        plan={planWith([
          checkpoint({ id: "open", title: "Accept the overrun", type: "escalation" }),
          checkpoint({ id: "final", title: "Confirm the plan", type: "confirm_plan" }),
        ])}
        busy={false}
        onDecision={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Resolve the other decisions first.")).toBeTruthy();
  });

  it("keeps checkpoint actions wired to the existing decision contract", () => {
    const onDecision = vi.fn();
    render(
      <CheckpointCards
        plan={planWith([checkpoint({ id: "brief", title: "Confirm the brief" })])}
        busy={false}
        onDecision={onDecision}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Needs you");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onDecision).toHaveBeenCalledWith({ checkpointId: "brief", action: "approve" });
  });

  it("shows the edit recovery action after a rejected checkpoint", () => {
    const onEdit = vi.fn();
    render(
      <CheckpointCards
        plan={planWith([checkpoint({ status: "rejected" })])}
        busy={false}
        onDecision={vi.fn()}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Returned to edit");
    fireEvent.click(screen.getByRole("button", { name: "Edit trip preferences" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
