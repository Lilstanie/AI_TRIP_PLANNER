---
date: 2026-10-19
author: Codex
branch: fix/multicity-transfer-validation
pr: none
area: packages/agents, apps/web, docs
contract-impact: none
---

# Validate multi-city transfers against overnight stays

## What changed

- Harden `packages/agents/src/itinerary/index.ts` against ambiguous, disconnected, or overlapping same-day transfer chains.
- Keep checkout-day transfers independent of the last overnight city's location constraint.
- Skip accommodation lookup for zero-night city segments and derive no-accommodation itinerary days from verified transfer chains.
- Extend `apps/web/tests/e2e/multicity-triage.e2e.mjs` to compare daily activities with selected overnight cities.
- Document the transfer and zero-night rules in paired architecture docs and an Agent Note.

## Why

The issue's public-plan follow-up also exposed that invalid transfer ordering could leave a stale city state available to later days. Unknown location now remains unknown instead of silently accepting activities.

## Validation

- Baseline focused agent tests before implementation: 3 targeted cases failed; reproduced day-one stay lookup, untimed transfer activity, destination activity after a one-way transfer, a disconnected chain retaining Sydney, and same-day transfer chains losing their final city.
- `pnpm --filter @trip/agents exec vitest run tests/itinerary/multi-city.test.ts`: 5 tests passed after implementation, including Day 2/Day 3 unknown-state assertions.
- `pnpm --filter @trip/agents test`: 13 files, 138 tests passed after the checkout-day regression fix.
- `pnpm --filter @trip/agents typecheck`: passed.
- `pnpm --filter @trip/web test`: 57 files, 632 tests passed. jsdom printed existing canvas `getContext` warnings; the test command exited successfully.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed; lint reports the existing `next lint` deprecation notice.
- `CHANNEL=chrome pnpm --filter @trip/web e2e multicity-triage`: passed API and desktop/mobile browser checks on the final source; artifact `output/e2e/runner/2026-10-18T20-35-25-582Z.json`.
- `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected`, `pnpm verify:e2e-artifacts` (77 scripts), `pnpm verify:e2e-selectors`, and `git diff --check`: passed.
- `pnpm exec prettier --check` on all changed source, E2E and documentation files: passed. `pnpm format:check-changed origin/main` will run after the implementation commit.
- An initial E2E launch without `CHANNEL=chrome` failed because this worktree lacks Playwright's headless shell; the documented browser-channel rerun passed.
- The first typecheck caught two assignments to the inferred non-optional city type; the explicit unknown-state type fixed both.

## Notes for the next person

The local E2E artifact remains until its evidence is quoted in the PR body. No live model or provider quota was used. The follow-up addresses the closed #437 acceptance gap and does not itself close that issue.

The new checkout-day regression first failed as expected because Day 3 activity in Wollongong was rejected against the Sydney stay; after removing the checkout-date stay fallback, the full agent suite passed.
