---
date: 2026-10-07
author: Claude Code
branch: feature/219-trace-box
pr: none
area: apps/web
contract-impact: none
---

# Agent Lab trace list scrolls in its own bounded box and follows the newest event (#219)

## What changed

- `apps/web/components/agent-lab/RunTimeline.tsx`: the list renders inside a focusable, named
  `[data-agent-lab-trace-box]` region that follows the tail while at the bottom, suspends on scroll up
  (wheel or scroll position) and resumes at the bottom. The follow scroll is instant.
- `apps/web/app/styles/agent-lab.css`: viewport-bound `max-height`, `overflow-y: scroll` and a styled
  always-visible scrollbar for the box.
- `apps/web/tests/e2e/agent-lab-trace.e2e.mjs`: new Trace view script (failure inventory first); later
  tickets of #218 extend it.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: describe the bounded trace box.

## Why

Instant follow always: a smooth scroll fires scroll events away from the bottom and would suspend its own
following, and the ticket only needs instant under reduced motion. `packages/shared` is untouched.

## Validation

- `pnpm --filter @trip/web e2e agent-lab-trace`: passes (three consecutive runs).
- `pnpm --filter @trip/web e2e 'agent-lab-*'`: every existing Agent Lab script passed; the trace script
  failed once in that batch on a test-side wheel animation and was fixed, then passed three times.
- `pnpm --filter @trip/web typecheck` and `lint`: pass.

## Notes for the next person

A wheel scroll back down can be cut short by arriving events; the box then is not yet at the bottom
and keeps not following until the visitor reaches it. The script jumps to the bottom with `scrollTop`.
