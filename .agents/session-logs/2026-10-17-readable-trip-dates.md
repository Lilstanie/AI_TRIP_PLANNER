---
date: 2026-10-17
author: Codex
branch: fix/readable-trip-dates-391-393
pr: none
area: apps/web, docs
contract-impact: none
---

# Localized readable dates across trip surfaces

## What changed

- Added a shared localized date-range formatter in `apps/web/lib/workspace/trip-facts.ts`.
- Used it in trip cards, the Trip summary and generated sidebar chat titles; preserved renamed/custom titles.
- Extended the `trip-ui-triage` browser journey and updated English and Chinese workspace docs.

## Why

- One formatter keeps date-only values timezone-stable and lets the active locale choose range ordering and punctuation.
- Sidebar generated titles are localized at display time so changing language does not rewrite saved records.

## Validation

- `pnpm install --frozen-lockfile` — completed; worktree dependencies installed from the existing lockfile.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs` — passed.
- `pnpm verify:protected` — passed.
- `pnpm verify:pairs` — passed; 26 documentation pairs checked.
- `pnpm verify:e2e-selectors` — passed.
- `pnpm format:check-changed` — passed.
- `git diff --check` — passed.
- Mock browser journey `trip-ui-triage` — passed, 138 checks; retained screenshots and `summary.json` under `output/playwright/trip-ui-triage/after-readable-dates/`.
- `pnpm verify:e2e-artifacts` — passed; all 72 E2E scripts write an artifact.

## Notes for the next person

- No Agent Note is needed; the change follows the existing locale and date-only conventions.
- Changes and browser evidence remain local on this branch; no push or PR was created.
