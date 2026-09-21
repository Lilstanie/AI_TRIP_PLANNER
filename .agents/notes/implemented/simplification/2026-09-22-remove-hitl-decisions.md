# Agent Note: Remove the decision and question apparatus

Status: implemented
Owner: A (@Lilstanie)

## Problem

Plans carried HITL checkpoints and the chat could ask structured questions, but no feature applied
a traveller's decision: `applyHitl` re-priced a stay and flipped a status, and nothing downstream
acted on a confirmation. A plan could sit "awaiting review" with no way to resolve it.

## Decision

`HitlCheckpoint`, `TripPlan.hitl`, `ChatQuestion` and `ChatNeedsInfo.asked` are removed from
`packages/shared`, along with the orchestrator's checkpoint code, the `ask_the_traveller` tool,
`/api/hitl`, and the checkpoint and question UI. `ChatNeedsInfo` remains as the "not enough to plan
yet" reply. A section's status comes from whether a conflict still targets it. Travellers change a
plan by saying so in chat or by editing the trip.

## Alternatives considered

**Move the checkpoints somewhere more usable.** Rejected by the product owner: re-housing a feature
that applies nothing keeps offering a capability the app does not have.

**Implement real decision handling.** Not pursued now; reintroducing HITL needs a downstream action
for each decision, not only a confirmation screen.

## Consequences

- A plan stored before the removal still has a `hitl` array; the schema strips it on load.
- The app asks nothing in a structured form; see
  [DSH thinking UI](../../../../docs/design/dsh-thinking-ui.md).

## Sources

[2026-09-22 removal log](../../../session-logs/2026-09-22-remove-decisions-and-questions.md)
