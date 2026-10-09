---
date: 2026-10-08
author: Claude
branch: feature/leg-travel-times-237
pr: none
area: apps/web, docs
contract-impact: none
---

# Each leg shows its travel time, and the traveller picks its mode (#237)

## What changed

- `lib/trip/leg-routes.ts` (new): leg modes, the 20-minute walk default, simulated fixture legs.
  `lib/integrations/google.ts`: `no_route` status, `RouteMode` gains DRIVE.
- `lib/trip/trip-edit.ts`, `app/api/trip/preview-edit/route.ts`: `leg` operation routes one leg; other
  legs keep stored durations; `no_route` clears `arriveBy`; mock mode uses the simulated dependencies.
- `lib/trip/item-actions.ts`: Remove, Ideas and day moves clear the next stop's leg.
- `components/trip/useLegRoutes.ts`, `previewRequest.ts` (new), `timeline/useTimelineEdits.ts`,
  `TripEditor.tsx`, `timeline/TimelineParts.tsx` (`LegRow`), `WorkspaceView.tsx`: automatic routing,
  leg control, undo. The Check routes button and the day-wide mode switch are removed.
- `GLOSSARY.md` (Leg); `docs/workspace-ui.md` and `.zh.md` (pairs recorded); the two implemented notes
  whose routing consequences changed link the proposed note.
- E2E: `timeline.e2e.mjs` route section rewritten with Places stubbed at the browser boundary; the fare
  section waits for in-flight routing; `workspace-chinese.e2e.mjs` checks the Chinese stop menu.
- Merged `feature/trip-drawer-no-confirmations` (b80b21f). Conflicts kept both sides in TripEditor,
  item-actions and the workspace UI docs.

## Why

- A leg is the destination stop's `arriveBy`, so `packages/shared` is unchanged.
- The day's routing key is its stops, places and times, not its leg fields. A leg's own change, including
  one that comes back `no_route`, must not route the whole day again; `noteLeg` records the day as current.
- `no_route` (Google answered with no route) is separate from an outage (refused edit with a keyed notice).
- Default mode, walk threshold and failure modes are in the proposed Agent Note.

## Validation

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no ESLint warnings or errors.
- `pnpm --filter @trip/web test`: exit 0, 50 files, 581 tests passed.
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places workspace-chinese`:
  exit 0. timeline 62 ok, itinerary 117 ok, auto-save-places 21 ok, workspace-chinese 39 ok; 0 failed,
  0 skipped. The route checks run with stubbed Places and simulated legs; no MAPS_API_KEY was used.
- `node scripts/verify-docs.mjs`: exit 0. `node scripts/verify-protected-files.mjs origin/main`: exit 0.
  `check-pairs.mjs`: 24 pairs, exit 0. Prettier `--check` on every changed file: exit 0.

## Notes for the next person

- The proposed note is not promoted; promote it after review and update its status.
- Not covered: the server `no_route` branch has no unit test (E2E intercept only); "other legs
  unchanged" is vacuous with one leg in the mock plan; the live Google path is untested (no key).
- A reload shows stored legs as estimates and drops "No route found" labels.
- `defaultLegRoute`'s docstring in `leg-routes.ts` still needs tidying.
- The desktop drawer screenshot after a time edit shows a stop's time stacked one digit per line.
  `TimelineStop` is unchanged on this branch; not checked against the base.
