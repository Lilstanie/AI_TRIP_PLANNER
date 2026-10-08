---
date: 2026-10-07
author: Claude
branch: feature/222-compare-trace-bars
pr: none
area: apps/web, docs
contract-impact: none
---

# Agent Lab Trace view: Compare bars on one shared step axis (#222)

## What changed

- `ComparisonPanel.tsx`: stacks one `TraceOverview` per strategy that produced events, in strategy order, above
  the columns, with `domainSteps` set to the longest run's record count. A cancelled comparison draws no bar for a
  strategy that never ran.
- `RunTimeline.tsx`: new `showOverview` (the Compare columns no longer draw their own bar) and `onJumpReady`
  (hands the panel each list's jump function, so a block scrolls only its own side's box).
- `TraceOverview.tsx`: `blockPrefix` puts the strategy name in each block's accessible name.
- `agent-lab.css`: stack styles. Docs (English and Chinese): architecture Agent Lab section, workspace UI.
- `agent-lab-trace.e2e.mjs`: failure inventory first (red: 9 failures), then alignment, longest-fills-axis,
  per-side jump, cancelled and phone checks. Aborted responses no longer reject `response.text()`.

## Validation

- `e2e agent-lab-trace`, `-replay` (alone), `-comparison`, `-revision`, `-failures`, `-single-agent`: pass. `typecheck`, `lint`, `verify:docs`, `verify:pairs`, `verify:protected`: pass.

## Notes for the next person

The shared domain counts records (events minus merged completions), not events, so it matches the bar model.
