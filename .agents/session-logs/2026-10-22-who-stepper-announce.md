---
date: 2026-10-22
author: Claude Code
branch: fix/who-stepper-announce
pr: none
area: apps/web, docs
contract-impact: none
---

# Who sheet steppers announce the new count with its label

## What changed

- `apps/web/components/preferences/FactFields.tsx`: each count is a `role="status"` region (which
  may carry the existing `aria-label`) with a visually hidden "Adults: " prefix, so + or − is
  announced as "Adults: 2" while only the number is shown (#518).
- `apps/web/tests/e2e/who-sheet-needs-adult.e2e.mjs`: checks the role, the announced text and the
  visible number after "Add an adult".
- `docs/workspace-ui.md` and its Chinese pair.

## Why

The `aria-label` stays because the status role may be named and `TripFactChips.test.tsx` finds the
count by that label; live regions announce content, hence the hidden prefix.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e who-sheet-needs-adult` with the component change
  stashed: exit 1, 6/7 (the region reads "1"). With it: exit 0, 7/7.
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

Not checked with a real screen reader.
