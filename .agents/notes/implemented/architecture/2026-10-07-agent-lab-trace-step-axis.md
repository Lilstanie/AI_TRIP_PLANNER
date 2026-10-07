# Agent Note: Agent Lab Trace view uses a step axis, not time

Status: implemented
Owner: A (@Lilstanie)

## Problem

The Agent Lab's trace is a long flat list. Visitors cannot see at a glance which specialist worked in what
order, or which one a revision round touched. An overview bar needs a horizontal axis, and the obvious
choice is elapsed time. But every `AgentLabRunEvent.elapsedMs` is stamped at publication, after events queue
and after a fixed 90 ms pacing delay per event, in fixture and live runs alike. A duration axis would show the
stream's pacing, not the work, and would serialise specialists that ran at the same time.

## Decision

The Trace view's time bar uses a steps axis: each record takes one equal-width slot, in the order the events
arrived. That order is accurate, because the queue preserves the graph's emission order. The bar is derived in
the browser by `apps/web/lib/agent-lab/trace-overview.ts` from the recorded events only, and drawn by
`apps/web/components/agent-lab/TraceOverview.tsx`. Lanes are Run, Coordinator, one per specialist, or a single
Baseline lane; a tool call's start and its completion or failure (matched by call id, oldest start first,
because a call id can repeat in a run) merge into one block.

`packages/shared` is not modified: no field is added, so no contract-impact applies. Replay needs no special
handling, because it re-emits the recorded events in order.

## Alternatives considered

- **A duration axis from `elapsedMs`.** Rejected: it would show the 90 ms pacing delay as work and could not show
  overlap. Revisit only if live runs become routinely enabled and the contract gains a true event timestamp.
- **A Duration toggle beside the steps axis.** Rejected for now: with fixture pacing it would offer a second
  picture that misleads.
- **Lanes by record type, as DeepSeek Harness does.** Rejected: its agent is single, whereas here the planning
  board's ordering between specialists is what needs to show.

## Consequences

- Specialists that overlap in time are drawn one after another; the bar shows dependencies (accommodation after
  transport, itinerary and dining after accommodation), not concurrency.
- The bar re-slots as a run grows, because the step count is the axis length; the Compare view will pass a shared
  step domain so stacked bars line up.
- No code is ported from DeepSeek Harness; only the idea of a lane overview is borrowed.
