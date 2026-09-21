"use client";
import type { HitlCheckpoint, HitlRequest, TripPlan } from "@trip/shared";
import { money } from "@/lib/workspace";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { SourceBadge } from "./SourceBadge";
export type Decision = Pick<HitlRequest, "checkpointId" | "action" | "candidateId">;

const CHECKPOINT_STATUS_LABEL: Record<HitlCheckpoint["status"], string> = {
  pending: "Needs you",
  deferred: "Deferred · still pending",
  rejected: "Returned to edit",
  approved: "Confirmed",
};

export function CheckpointCards({
  plan,
  busy,
  onDecision,
  onEdit,
}: {
  plan: TripPlan;
  busy: boolean;
  onDecision: (decision: Decision) => void;
  onEdit: () => void;
}) {
  return (
    <div className="checkpoints">
      {/* An approved checkpoint is a decision the traveller already made; leaving its card up
          reads as still needing them. `select_stay` is the exception: picking a hotel approves it
          immediately, and this is the only place a hotel can be changed, so its card stays as a
          live chooser. `blocked` below still reads the full `plan.hitl`, so hiding a card never
          loosens the confirm-plan prerequisite. */}
      {plan.hitl
        .filter(
          (checkpoint) => checkpoint.status !== "approved" || checkpoint.type === "select_stay",
        )
        .map((checkpoint) => {
          const stay = plan.sections
            .find((s) => s.id === checkpoint.sectionId)
            ?.proposal?.stays?.find((s) => s.id === checkpoint.stayId);
          const source = plan.sections.find((s) => s.id === checkpoint.sectionId)?.proposal?.source;
          const blocked =
            checkpoint.type === "confirm_plan" &&
            plan.hitl.some((c) => c.id !== checkpoint.id && c.status !== "approved");
          return (
            <article
              className={`checkpoint checkpoint--${checkpoint.status}${blocked ? " checkpoint--blocked" : ""}`}
              data-status={checkpoint.status}
              key={checkpoint.id}
            >
              <div className="checkpoint__head">
                <h3>{checkpoint.title}</h3>
                <Badge
                  variant={checkpoint.status === "approved" ? "secondary" : "outline"}
                  className={`checkpoint__status checkpoint__status--${checkpoint.status}`}
                  role="status"
                >
                  {CHECKPOINT_STATUS_LABEL[checkpoint.status]}
                </Badge>
              </div>
              <p>{checkpoint.detail}</p>
              {stay && (
                <div
                  className="stay-options"
                  role="group"
                  aria-label={`Hotel choices in ${stay.city}`}
                >
                  <div className="checkpoint__source">
                    <SourceBadge source={source} compact />
                    <span>
                      {source?.kind === "live"
                        ? "Live rate; availability can change before booking."
                        : source?.kind === "estimated"
                          ? "Estimated price; verify the property before booking."
                          : "No reservation is made from this workspace."}
                    </span>
                  </div>
                  {stay.candidates.map((choice) => (
                    <button
                      type="button"
                      disabled={busy}
                      className={`stay-option${stay.selectedId === choice.id ? " stay-option--selected" : ""}`}
                      key={choice.id}
                      aria-pressed={stay.selectedId === choice.id}
                      onClick={() =>
                        onDecision({
                          checkpointId: checkpoint.id,
                          action: "select_stay",
                          candidateId: choice.id,
                        })
                      }
                    >
                      <strong>{choice.name}</strong>
                      <span>
                        {choice.area} · {choice.rating}/10 ·{" "}
                        {choice.freeCancellation ? "Free cancellation" : "No free cancellation"}
                      </span>
                      <span>
                        {money(choice.pricePerNight * stay.rooms * stay.nights)} total ·{" "}
                        {stay.rooms} room(s) × {stay.nights} nights
                      </span>
                      <small>
                        {stay.selectedId === choice.id
                          ? checkpoint.status === "approved"
                            ? "Selected and confirmed"
                            : "Suggested · click to confirm"
                          : "Choose this stay"}
                      </small>
                    </button>
                  ))}
                  <small className="muted">No reservation will be made from this workspace.</small>
                </div>
              )}
              {checkpoint.status !== "approved" && (
                <div className="actions">
                  {checkpoint.type !== "select_stay" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || blocked}
                      onClick={() => onDecision({ checkpointId: checkpoint.id, action: "approve" })}
                    >
                      {checkpoint.type === "escalation" ? "Accept these conflicts" : "Confirm"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onDecision({ checkpointId: checkpoint.id, action: "reject" })}
                  >
                    Return to edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy || checkpoint.status === "deferred"}
                    onClick={() => onDecision({ checkpointId: checkpoint.id, action: "defer" })}
                  >
                    Decide later
                  </Button>
                </div>
              )}
              {checkpoint.status === "rejected" && (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onEdit}>
                  Edit trip preferences
                </Button>
              )}
              {blocked && (
                <small className="checkpoint__blocked" role="status">
                  Resolve the other decisions first.
                </small>
              )}
            </article>
          );
        })}
    </div>
  );
}
