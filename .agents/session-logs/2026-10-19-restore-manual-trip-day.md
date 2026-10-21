---
date: 2026-10-19
author: Codex
branch: fix/restore-trip-day-view
pr: none
area: apps/web, docs
contract-impact: none
---

# Restore the manually selected trip day after reload

## What changed

- Saved manually selected days per trip in browser local storage and restored them on later visits.
- Added a reload assertion to `on-trip-day.e2e.mjs`; corrected the narrow-headroom fixture from 400 to 480 against a 500 budget.
- Updated English and Chinese workspace behavior documentation.

## Why

Issue #409's acceptance criteria require a saved manual day choice to take precedence over the on-trip automatic day. The browser journey also contained an unrelated fixture value that did not meet its existing 5% headroom condition.

## Validation

- Before implementation, `CHANNEL=chrome pnpm --filter @trip/web e2e on-trip-day` failed the new “manual day selection is restored after reload” assertion.
- After implementation and fixture correction, the same command passed all 20 assertions with no browser errors. Screenshot: `output/playwright/on-trip-day/latest/on-trip-sydney-boundary.png`; runner report: `output/e2e/runner/2026-10-18T17-30-00-819Z.json`.
- `pnpm --filter @trip/web test`: 57 files and 632 tests passed (jsdom canvas warnings from existing map and animation dependencies).
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm exec prettier --check ...`, and `git diff --check` passed.
- `pnpm format:check-changed origin/main` reported no committed files to check at that point; explicit Prettier check covered the four edited source and documentation files.

## Notes for the next person

The initial browser run also exposed the headroom fixture mismatch; the corrected fixture now exercises a 4% margin. No Agent Note is needed.
