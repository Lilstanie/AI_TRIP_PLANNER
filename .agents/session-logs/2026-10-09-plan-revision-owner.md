---
date: 2026-10-09
author: Claude Code (ticket #260 refactor run)
branch: refactor/plan-revision-owner
pr: 258
area: apps/web, docs, .agents
contract-impact: none
---

# One owner for plan revisions and background work (#260, spec #259)

## What changed

- `apps/web/components/trip/plan-revision.ts` (new): `usePlanRevision`, the one owner. Background jobs start
  only when nothing else is in flight for the trip and the plan is current; `edit` aborts a job at once and
  applies the traveller's accepted edit; a discarded job is reported so its hook asks again.
- `useAutoSavePlaces.ts`, `useLegRoutes.ts`, `timeline/useTimelineEdits.ts`, `useChooseCandidate.ts`: thin
  callers of the owner. `useLegRoutes` no longer records a day as checked on first sight.
- `WorkspaceView.tsx`, `TripEditor.tsx`: no `enabled` gating; the owner gets `held` and is passed to the editor.
- `previewRequest.ts`: optional `failure` notice, so the chooser keeps its own fallback text.
- `apps/web/tests/e2e/plan-revision.e2e.mjs` (new), `tests/components/trip/TripEditor.test.tsx` (harness only:
  renders through the owner; no test added or removed).
- Docs: `docs/workspace-ui.md` and `.zh.md` (pair recorded). Notes: `implemented/feature/2026-10-09-plan-revision-owner.md`
  (new); `2026-10-08-leg-travel-times.md` gains a dated pointer for the removed first-sight rule.

## Why

Background work and edits had three abort and version rules, a route check and a save could run together, and a
day with saved places and stored times could be marked checked without a check. The E2E on the base branch failed
on day 2 (never checked) and showed six overlapping requests. See the Agent Note for the failure modes.

## Validation

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no warnings.
- `pnpm --filter @trip/web test`: exit 0, 581 tests pass (base f1ac06c also has 581, not 594).
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places workspace-chinese plan-revision`:
  exit 0, all five ok. Red before the code: plan-revision scenario 3 failed (day 2 never checked; 6 overlapping).
- `DATA_MODE=mock pnpm --filter @trip/web e2e drawer-walkthrough choose-fare-and-stay`: exit 0.
- `node scripts/verify-docs.mjs`, `check-pairs.mjs`, `verify-protected-files.mjs origin/main`: see the final report.

## Notes for the next person

- Behaviour change: each day with two or more stops is checked once per page load (no first-sight shortcut).
  Each check is one Routes request per leg in live mode. A stored "checked" flag would avoid it; that is a contract change.
- Scenarios 1 and 2 of plan-revision passed on the base branch too; they are regression guards, not red tests.
- Known open item from the spec (not this ticket): cross-tab edit safety.
