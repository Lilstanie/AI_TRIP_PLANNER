---
date: 2026-10-08
author: Claude
branch: feature/remove-status-labels-240
pr: none
area: apps/web
contract-impact: none
---

# Remove status labels and Review plan; show conflicts where they apply (#240)

## What changed

- Removed the "Needs review" and "Draft" trip status (catalog `TripRecord.status`, `statusForPlan`,
  the header and trip-list labels), the "Review plan" button and dialog, and the "Needs you" label.
  Stored `status` keys are ignored on load.
- Unresolved conflicts render where they apply: `placeConflicts()` in `apps/web/lib/trip/conflicts.ts`
  places each on its stop, on its day title, or under the budget bar. Time overlaps mark each stop
  involved; the day title is the fallback when no stop is involved.
- A chat replan that had an earlier estimate shows a one-off, dismissible notice with the signed
  change (`estimateChange` in the session reducer; a timeline edit or a new chat clears it).
- Chinese entries added for every new string in `apps/web/lib/i18n/workspace-messages.ts`.
- Docs: `docs/workspace-ui.md` and `.zh.md` (pairs recorded), Agent Note
  `.agents/notes/proposed/feature/2026-10-08-remove-status-labels.md`, and a Supersession line in the
  #235 and one-day-view implemented notes (status unchanged).

## Why

#240 under parent spec #233: the status labels and Review plan repeated what the plan already shows,
and conflicts were only listed in a dialog away from the stop they concern.

## Validation

- E2E: `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places workspace-chinese`
  exit 0: timeline 93, itinerary 117, auto-save-places 21, workspace-chinese 39 ok; 0 FAIL, 0 skip.
- New E2E checks: no status label at 1440 and 390 in both schemes; conflicts placed on stops and under
  the budget bar; trip list has no label; replan notice shows the signed change once and Dismiss
  removes it; each stop time sits on two lines with its digits not stacked.
- Stop time: the check first failed at all four widths (9 to 11 one-character lines per time, from
  the inherited `overflow-wrap: anywhere` of `.trip-editor`). `white-space: nowrap` on
  `button.timeline-stop__time` fixed it (narrowest line 35.7 px, two lines).
- Unit tests: only existing tests updated for removed behaviour; none added.
- `npx tsc --noEmit`, `pnpm --filter @trip/web lint`, `pnpm --filter @trip/web test`,
  `node scripts/verify-docs.mjs`, `node scripts/verify-protected-files.mjs origin/main`,
  `check-pairs.mjs`, Prettier on changed files: see the final report.

## Known limitations

- Conflict text written by specialists and route messages still shows in English in the Chinese UI.
- `INFEASIBLE_BUDGET` is not exported from `@trip/orchestrator`; its "infeasible budget" prefix is
  duplicated in `conflicts.ts` with a comment.
- The proposed Agent Note is not promoted to implemented; that needs a separate decision.
