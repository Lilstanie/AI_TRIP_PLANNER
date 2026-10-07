---
date: 2026-10-07
author: Claude (AI-assisted)
branch: feature/221-trace-folds
pr: none
area: apps/web, docs
contract-impact: none
---

# Add Rounds and Calls folds to the Agent Lab trace panel (#221)

## What changed

- `RunTimeline.tsx`: a toolbar with Fold rounds and Fold calls (buttons with `aria-pressed`); one heading per
  round; folded rows are not rendered. Run-level rows never fold.
- `agent-lab.css`: toolbar, pressed state and round heading styles.
- `agent-lab-trace.e2e.mjs`: a delimited #221 section (failure inventory first, desktop, Compare and phone).
- `docs/workspace-ui.md` and `.zh.md`: describe the folds.

## Why

Fold state lives inside each list, so Compare sides fold independently and the panel heading is untouched.
The toolbar buttons use `height: 44px` because the shared 36px `min-height` floor in forms.css outranks a
`min-height` set here.

## Validation

- `pnpm --filter @trip/web e2e agent-lab-trace`: passes (see the final report for the other checks).

## Notes for the next person

The time bar from #220 is not present on this branch, so "folding does not change the bar" is not checked.
