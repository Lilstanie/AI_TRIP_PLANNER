---
date: 2026-10-17
author: Codex
branch: fix/review-triage-oct17
pr: 438
area: apps/web, packages/shared, packages/tools, packages/orchestrator, docs
contract-impact: packages/shared
---

# Complete the October 17 planner issue batch

## What changed

- Implemented the triaged planner, saved-chat, trip and mobile workspace fixes in PR #438.
- Added destination-scoped coordinates and destination-local historical-date handling.
- Grounded booking and plan-change claims across chat return paths; clarified unpriced-stop budget status.
- Recorded the destination/timezone contract decision in an Agent Note.

## Why

Selected coordinates may become stale after a destination edit, and a booked stay is not evidence that flights were purchased. Both boundaries have explicit regression coverage.

## Validation

- `pnpm build`, `pnpm typecheck`, `pnpm test` — passed on the final production changes; six packages.
- `pnpm test:scripts` — 35/35 passed.
- `pnpm --filter @trip/web e2e where-sheet-save` — 14/14 passed; runner artifact `output/e2e/runner/2026-10-17T12-26-25-536Z.json`.
- `pnpm --filter @trip/web e2e on-trip-day` — 21/21 passed; runner artifact `output/e2e/runner/2026-10-17T12-29-08-223Z.json`.
- `pnpm --filter @trip/web e2e trip-ui-triage` — passed across 24 language/theme/viewport scenarios; runner artifact `output/e2e/runner/2026-10-17T12-31-28-956Z.json`.
- `pnpm verify:docs`, `pnpm verify:pairs` (26 pairs), `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` (72 scripts), `pnpm format:check-changed origin/main`, `git diff --check` — passed.
- Added-comment check — no violations. Changed web ESLint paths excluding `TripEditor.tsx` — passed. Including that file reports missing configured rule `react-hooks/exhaustive-deps` on existing disable directives; full web lint also has existing failures in unrelated E2E files.

## Notes for the next person

- Mock browser checks do not verify live provider availability, real bookings, or authenticated production behavior.
- PR body and current-head CI remain to be updated/verified.
