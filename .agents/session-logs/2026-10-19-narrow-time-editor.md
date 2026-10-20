---
date: 2026-10-19
author: Codex
branch: fix/narrow-trip-time-editor
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep time controls inside a narrow Trip drawer

## What changed

- Moved `TimeForm` from the stop's content cell to its own grid row; narrow containers use the full row.
- Constrained the form's intrinsic input width and kept the timeline rail behind its controls.
- Added `narrow-time-editor.e2e.mjs` and synchronized the workspace UI documentation pair.

## Validation

- Red: `CHANNEL=chrome LABEL=red pnpm --filter @trip/web e2e narrow-time-editor` failed with drawer horizontal scrollLeft 53 at 1001px / 75% split.
- Green: `CHANNEL=chrome LABEL=final2 pnpm --filter @trip/web e2e narrow-time-editor` passed 20 EN/ZH viewport/split cases, invalid ranges, Escape focus return and phone saves; no page errors.
- Viewports: 1440, 1001, 1000, 521, 520 and 390px; desktop Home/End/default split. Mock example trip from blank chat; no provider credentials.
- `pnpm --filter @trip/web test`: 57 files / 632 tests passed.
- `pnpm --filter @trip/web typecheck`: passed.
- `pnpm --filter @trip/web lint`: passed.
- Evidence: `output/playwright/narrow-time-editor/{red,final2}` and raw runner JSON summaries; earlier setup failures retained.

## Notes for the next person

- Browser viewport simulation only; physical keyboards and live providers were not checked.
- Wide drawers keep the form in the content column. The workspace split and other stop fields are unchanged.
