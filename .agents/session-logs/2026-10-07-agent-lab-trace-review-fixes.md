---
date: 2026-10-07
author: Claude (AI-assisted)
branch: feature/agent-lab-trace-view
pr: 230
area: apps/web, docs
contract-impact: none
---

# Review fixes for the Agent Lab Trace view (#218)

## What changed

- `RunTimeline.tsx`: a time-bar click on a row hidden by a fold now opens the folds and jumps (it did
  nothing before); the two JSDoc blocks that had been split around `roundOf` are one comment again.
- `agent-lab.css`: bar blocks are 24 px tall (44 px at phone width), failed blocks carry a diagonal stripe
  besides the error colour, and a `forced-colors` block gives every block a border.
- `agent-lab-trace.e2e.mjs`: failure inventory first, then checks for the jump through a fold, block
  heights and the forced-colors border (a forced-colors browser context).
- `docs/workspace-ui.md` and `.zh.md`: describe all three.

## Why

WCAG 2.5.8 asks for 24 px targets, and the better-accessibility skill forbids colour as the only status
signal. Blocks are still as narrow as the equal step slots make them on a long run, so the width of a
target is not guaranteed; the keyboard path and the row list remain the equivalents.

## Validation

See the final report: `pnpm --filter @trip/web e2e 'agent-lab-*'`, typecheck, lint and the verify scripts.
`agent-lab-replay` batched with the other scripts also passes on origin/main, so the reported file-chooser
timeout was not caused by this branch.

## Notes for the next person

THIRD_PARTY_NOTICES.md quotes the DeepSeek Harness licence text and copyright line from memory of the
upstream; nobody verified them against the upstream LICENSE file.
