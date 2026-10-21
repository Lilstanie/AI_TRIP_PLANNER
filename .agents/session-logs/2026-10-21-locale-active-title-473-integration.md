---
date: 2026-10-21
author: Codex
branch: feature/locale-example-active-title
pr: 488
area: apps/web, docs
contract-impact: none
---

# Revalidate localized example and active trip title after #473

## What changed

- Merged `origin/main` at `3d8a9e16005e1e27ec72eb9aa3ea99d5b65c6ce5` into the PR branch.
- Re-ran the calendar/date/title browser path against the integrated tree.
- Added desktop and phone screenshots to the PR Evidence section after upload.

## Why

The parent PR added day-tab semantics after the previous #488 integration, so the combined tree needed focused regression evidence before merge.

## Validation

- Tested code tree: `52ff657a26bf887146c85634961fc7bb781eca59`, tree `daf90a38dc7bb1ff3d9e7ebd301be8600cede44e`.
- `CHANNEL=chrome pnpm --filter @trip/web e2e calendar-trip-date-label` — passed 121/121 at 1440/390/375 px in English and Chinese; report `output/e2e/runner/2026-10-21T01-33-15-890Z.json`.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm verify:docs` — passed.
- `pnpm verify:pairs` — passed, 27 pairs.
- `pnpm verify:protected` — passed.
- `pnpm format:check-changed origin/main` — passed, 6 files.

## Notes for the next person

- Fixture-backed browser coverage; it does not claim live-provider or physical-device behavior.
- Screenshots are linked in the PR Evidence section.
