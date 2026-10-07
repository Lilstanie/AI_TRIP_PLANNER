---
date: 2026-10-07
author: Claude
branch: feature/220-trace-time-bar
pr: none
area: apps/web, docs
contract-impact: none
---

# Agent Lab Trace view: step-axis time bar with jump-to-record (#220)

## What changed

- `apps/web/lib/agent-lab/trace-overview.ts`: pure derivation of lanes, one record per event (tool start and
  completion merged by call id, oldest start first), error flags and round boundaries.
- `apps/web/components/agent-lab/TraceOverview.tsx`: the bar, with a `domainSteps` prop for #222's Compare view.
- `RunTimeline.tsx`: renders the bar above the box, adds `data-trace-row` to rows and the jump and highlight.
- `agent-lab.css`, `forms.css`: bar styles; `.agent-lab__trace-block` is exempt from the global button rules.
- `agent-lab-trace.e2e.mjs`: failure inventory first, then bar, jump, baseline, replay, Failure Lab, phone checks.
- Docs (English and Chinese): architecture Agent Lab section, workspace UI; Agent Note for the step axis.

## Why

The axis is steps, not time: `elapsedMs` includes the 90 ms pacing delay. See the Agent Note
`2026-10-07-agent-lab-trace-step-axis.md`. No DeepSeek Harness code was ported, so the notices file lists none.

## Validation

- `pnpm --filter @trip/web e2e agent-lab-trace`: passes.
- Other checks: see the final report of the implementing session.

## Notes for the next person

A call id can repeat within a run (round 2 transport starts `transport:2:1` twice), so match completions
first-in first-out. Folds from #221 hide rows; a jump to a hidden row finds no element and does nothing.
