---
date: 2026-10-26
author: Codex
branch: feature/TP-105-trip-drafts
pr: none
area: apps/web, docs
contract-impact: none
---

# Preserve Trip Stop drafts through workspace navigation

## What changed

- Added the in-memory Trip draft controller, per-field hooks and restore entry in `TripDrafts.tsx`.
- Moved time, place, note and details forms onto shared drafts; added all-size discard confirmation and stale rebase handling.
- Added a browser fixture and failure inventory for restore, cancel and failed-save journeys.
- Updated the English/Chinese workspace behavior pair.

## Why

Stop editors can unmount during ordinary navigation. The provider must sit above those layout branches to retain drafts and expose a route back to each field. Synthetic `add` drafts are included so the parent can connect AddStop without relying on a rendered Stop row.

## Validation

- `pnpm --filter @trip/web typecheck` — passed.
- `BASE_URL=http://localhost:3115 EVIDENCE_LABEL=pre-integration node apps/web/tests/e2e/trip-drafts.e2e.mjs` — expected red at the provider integration boundary on desktop and phone; saved Trip fixture opened, then `TripDraftsProvider` was missing from the parent-owned workspace composition.
- `node --check apps/web/tests/e2e/trip-drafts.e2e.mjs` — passed.
- `pnpm verify:docs` — passed.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs` — passed (29 pairs).
- `git diff --check` — passed.

## Notes for the next person

Wrap all Trip surfaces in one `TripDraftsProvider` above view/layout unmounts, without keying the provider by `tripId`. Render `TripDraftRestoreEntry`; route a selected normal draft to its day/Stop and open the field. For `field: "add"`, use a stable synthetic `stopId` such as `__add-stop:<day>`, restore its record into the add composer, and consume it only after successful save or confirmed discard. Parent merger owns this composition and final green E2E run. Drafts are session-memory only; reload persistence is not implemented here.
