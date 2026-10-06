---
date: 2026-10-06
author: Claude Code
branch: fix/189-zh-remaining-strings
pr: none
area: apps/web, docs
contract-impact: api
---

# Chinese interface translates the remaining authored notices (#189)

## What changed

- `apps/web/lib/i18n/workspace-messages.ts`: Chinese entries for the attachment limit, Your data
  value, account-delete and stream-frame fallbacks, failed preview/search, stop-action errors
  (including the Move earlier/later guards) and timeline edit blockers/differences.
- `apps/web/lib/i18n/locale.ts`: `interfaceNotice` now walks a pattern table; new patterns cover
  `Day N has no room left…` and the three `Day N: …` edit blockers, with `{placeholders}`.
- `apps/web/lib/trip/trip-edit.ts`: `EditPreview.differences` is now `EditDifference[]`
  (`stop`, optional `days`, `before`, `after`, `placeChanged`) instead of English sentences;
  `EditPreviewPanel` words them with `t()` and passes blockers through `notice()`.
- `useComposerAttachments`, `SettingsDialog`, `TripMap` (raw `nearbyRoute.error`) now localise.
- `tests/e2e/workspace-chinese.e2e.mjs`: a 1440 px notices walk; the 390 px path was updated to the
  phone shell (language switch on Mine, Trip and Mine tabs). `docs/workspace-ui(.zh).md` and the
  better-writing skill describe the notice path.

## Why

Blockers stay English strings because unresolved ones are also written into
`proposal.conflictsWith` / `editIssues` on the saved plan; differences are only shown in the
preview, so they became values. `/api/trip/preview-edit` therefore returns objects in
`differences` (no other consumer).

## Validation

- `workspace-chinese.e2e.mjs` (mock, port 3126): new checks failed first (10 FAIL), then 37 ok,
  0 failed.
- `timeline.e2e.mjs`: 32 ok, 0 failed (route check skipped, no map key).
- `ui-language.e2e.mjs`: 15 ok, 0 failed.
- `vitest` TripEditor + trip-edit: 20 passed (fixture updated to the new difference shape).
- `pnpm --filter @trip/web typecheck` and `lint`: clean.

## Notes for the next person

- Not reachable in the E2E: the signed-in Your data value, account delete, the from-location route
  error (needs a map key and location) and the first/last stop guards (the menu hides those items).
  They have dictionary entries only.
- "Changed activity price requires verification" is never rendered today; it has an entry so
  `notice()` covers it if it is.
