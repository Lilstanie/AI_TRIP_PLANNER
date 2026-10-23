# Agent Note: stream the planning loop's decisions in the chat

Status: implemented
Owner: ticket #557

## Problem

The chat stream showed what each specialist did but not why the plan changed between rounds. The
facts exist as typed `WorkflowDecision` values in `packages/orchestrator/src/decisions.ts`, but only
the Agent Lab received them through `OrchestratorOptions.onDecision`. A chat view could show a
conflict, a revision score or the stop reason only by parsing the `coordinator` event's prose.

## Decision

- `AgentProgressEvent` in `packages/shared/src/chat.ts` gains a `decision` variant:
  `{ type: "decision", round, decision }`. `decision` is `ChatWorkflowDecision`, a schema that
  mirrors `WorkflowDecision` one to one. `round` repeats `decision.round` so every progress event
  keeps a top-level `round`.
- `runTripChat` wires `onDecision` to `onProgress` whenever the caller passes `onProgress`, so
  `POST /api/chat` streams the events next to the existing ones. A caller that passes its own
  `onDecision` keeps it.
- The `coordinator` events are unchanged, and the Agent Lab still publishes its own `lab_*`
  events. The Agent Lab trace never receives `decision`; its event switches only handle the new
  variant so the union stays exhaustive.

## Alternatives considered

**Parse the `coordinator` summary and constraints.** Rejected: the target specialist, the saving and
the stop reason are structured facts, and prose changes with the interface language.

**Reuse the Agent Lab `lab_*` events in the chat.** Rejected: they carry lab-only summaries and
belong to the Lab's own lifecycle contract.

## Consequences

- Chat consumers can read conflicts, revision scores and stop reasons as data. The schema is a copy
  of the orchestrator type, so a new `WorkflowDecision` variant needs a matching variant in
  `ChatWorkflowDecision`.
- Older clients that ignore unknown event types keep working.

## Sources

[2026-10-22 chat decision events log](../../../session-logs/2026-10-22-chat-decision-events.md)
