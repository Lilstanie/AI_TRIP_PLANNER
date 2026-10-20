---
date: 2026-10-19
author: Codex
branch: fix/unpriced-budget-caution
pr: none
area: apps/web, docs
contract-impact: none
---

# Qualify under-budget estimates with unpriced stops

## What changed

- `apps/web/components/trip/TripPanel.tsx` shows caution whenever unpriced stops remain and the known estimate is at or below budget; removed the 5% headroom calculation.
- Updated `docs/workspace-ui.md` and `docs/workspace-ui.zh.md` to document the current status.

## Why

Issue #435's broader acceptance says the summary must avoid implying the whole trip is guaranteed to fit while costs remain unpriced. The previous 5% cutoff left larger headroom estimates unqualified.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e on-trip-day` — 21/21 assertions passed; covers exact-budget and below-budget unpriced cases, existing defaults, and no browser errors. Artifact: `output/e2e/runner/2026-10-18T21-35-18-170Z.json`; screenshots: `output/playwright/on-trip-day/latest/`.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm --filter @trip/web test` — 57 files, 632 tests passed; jsdom emitted existing canvas-not-implemented warnings.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` — passed.
- `pnpm exec prettier --check apps/web/components/trip/TripPanel.tsx docs/workspace-ui.md docs/workspace-ui.zh.md` — passed.
- `node .agents/skills/review-trip-planner/scripts/check-added-comments.mjs --base HEAD --path apps/web/components/trip/TripPanel.tsx` — passed with no violations.
- `git diff --check` — passed.

## Notes for the next person

Issue #435 is reopened for this follow-up. No Agent Note is needed for this localized bug fix. Larger E2E journeys for other issues timed out earlier in the session and are outside this change.
