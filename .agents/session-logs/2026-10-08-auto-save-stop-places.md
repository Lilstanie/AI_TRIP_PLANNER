---
date: 2026-10-08
author: Claude (Haiku 5.5, Claude Code)
branch: feature/one-day-trip-view
pr: none
area: apps/web, docs
contract-impact: none
---

# Map-found places are saved on their stops automatically (#236)

## What changed

- `apps/web/components/trip/useAutoSavePlaces.ts` (new): saves each scheduled stop's map-found place
  once through `POST /api/trip/preview-edit` (`place` operation), one save in flight at a time.
- `apps/web/components/workspace/WorkspaceView.tsx`: runs the hook, so saves do not wait for the Trip
  timeline tab to open. Passes its state to `TripEditor.tsx` as `saves`.
- `timeline/TimelineStop.tsx`: removed the "Map match · not confirmed" badge and "Use this place" box;
  added "Saving place…", "Place not saved yet" and a not-found hint with the search.
- `apps/web/lib/i18n/workspace-messages.ts`: copy for the new states; removed the retired strings.
- `apps/web/tests/e2e/auto-save-places.e2e.mjs` (new), `timeline.e2e.mjs` (confirm step waits for the
  automatic save). Docs: `docs/workspace-ui.md` and `.zh.md` (pair recorded).
- Agent Note: `.agents/notes/proposed/feature/2026-10-08-auto-save-stop-places.md` (failure modes).

## Why

The map's name match was a confirmation the traveller had to press; spec #233 removes those. The
runner sits in the workspace because the timeline mounts only on the Trip tab.

## Validation

- `pnpm install --frozen-lockfile`; `npx tsc --noEmit` (apps/web): pass.
- `pnpm --filter @trip/web lint`: no warnings or errors.
- `node scripts/verify-docs.mjs`: pass. `check-pairs.mjs`: 24 pairs, after `--record docs/workspace-ui.md`.
- `node scripts/verify-protected-files.mjs origin/main`: pass.
- `DATA_MODE=mock pnpm --filter @trip/web e2e auto-save-places`: 21 checks, all pass.
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline`: run 2 passed 46/46. Run 1 failed one
  trip-list check and then timed out; the same run on base 8482822 passed. Treated as flaky.

## Notes for the next person

- The E2E stubs Places and the place edit at the browser boundary (no map key here). The live
  server path for a place save is covered by the existing `trip-edit` unit tests, not by this E2E.
- Not covered: a newer chat plan cancelling an in-flight save. The hook aborts on every plan change.
- Auto-saves set `priceNeedsReview` and re-time days with walking routes (existing place-edit rules).
- Failed saves are not retried automatically; the traveller saves by search.
