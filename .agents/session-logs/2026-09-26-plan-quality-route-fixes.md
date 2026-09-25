---
date: 2026-09-26
author: Claude Code
branch: fix/route-false-conflicts
pr: none
area: packages/tools, packages/agents, apps/web/tests, docs
contract-impact: none
---

# Stop false route conflicts from degrading itineraries; add a plan-quality E2E

## What changed

- `packages/tools/src/maps.ts`: Google `route()` falls back to a labelled driving leg when transit is
  empty, or over 90 minutes and more than twice the driving time.
- `packages/agents/src/itinerary/index.ts`: one corrective model retry with the validation error;
  generic candidates ("Bali", "Neighborhood") filtered; the same stop twice in a day is rejected; a
  conflicting revision switches to the fallback only when the fallback conflicts less.
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: live/mock E2E over `/api/chat` with plan-quality checks;
  artifacts under `output/e2e/plan-quality/` (now git-ignored).
- Docs: `docs/workspace-ui.md` (driving fallback), `docs/development.md` (E2E command).

## Why

A live run showed Tokyo and Bali itineraries ending as the deterministic template: Google has no
transit data for Japan, so "no route returned" raised geography conflicts, and every conflicting
revision was replaced by the fallback. Revisions also cleared conflicts by repeating a stop.

## Validation

- `pnpm --filter @trip/tools test`: 113 passed; `pnpm --filter @trip/agents test`: 117 passed;
  `tsc --noEmit` clean in both packages.
- `node apps/web/tests/e2e/plan-quality.e2e.mjs` (live): Tokyo and Bali itineraries model-planned
  with no route conflicts, repeats or generic stops. Paris still 505% over budget.

## Notes for the next person

Budget coordination is unsolved: specialists plan in parallel from the brief only, and budget
revisions are a fixed "cut ~30%". The superseding design is the next PR's Agent Note.
