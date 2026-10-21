---
date: 2026-10-21
author: Codex
branch: feature/locale-example-active-title
pr: pending
area: apps/web, docs
contract-impact: none
---

# Localize submitted example prompts and active trip titles

## What changed

- `ChatPanel.tsx` sends the example prompt in the selected interface language.
- `WorkspaceView.tsx` sets an active trip title with the localized date range and restores the generic title when inactive.
- E2E coverage checks prompt locale and title behavior at desktop and phone widths; EN/ZH workspace docs now match behavior.

## Why

- Issue #387 exposed the mismatch between localized example labels and English submitted prompts; #472 exposed the generic title during an active trip.
- The prompt translation retains the example dates, travellers and budget.

## Validation

- `pnpm build`, `pnpm typecheck`: passed.
- `pnpm test`: passed, 642 tests across 57 web files and all six Turbo package tasks. An earlier run exposed a stale English-prompt assertion; it was updated to assert the Chinese prompt and the suite then passed.
- `CHANNEL=chrome pnpm --filter @trip/web e2e chinese-locale-controls`: passed, 10 checks; runner artifact `output/e2e/runner/2026-10-21T01-08-15-925Z.json`.
- `CHANNEL=chrome pnpm --filter @trip/web e2e calendar-trip-date-label`: passed, 121 checks at 1440, 390 and 375 px in EN/ZH; artifact `output/e2e/runner/2026-10-21T01-08-15-910Z.json`; screenshots in `output/playwright/calendar-trip-date-label/latest/`.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, `pnpm test:scripts`, `pnpm --filter @trip/web lint`, `pnpm exec turbo run lint --concurrency=1`, `pnpm exec prettier --check <six changed source/doc files>`, `git diff --check`: passed; script suite 40/40 and 27 EN/ZH pairs.
- Plain `pnpm lint` exits 1 with 26,233 errors in generated Next/MapLibre bundles; scoped web lint and all six serial Turbo package lint tasks pass.

## Notes for the next person

- E2E uses the local fixture/mock workspace, not live provider responses or an installed phone. Earlier first E2E attempt lacked installed Playwright; `pnpm install --frozen-lockfile` succeeded before the passing runs.
- UI screenshots and E2E artifacts must be attached/quoted in the PR before `pnpm clean:output`.
