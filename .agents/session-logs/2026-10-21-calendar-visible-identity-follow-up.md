---
date: 2026-10-21
author: Codex
branch: fix/calendar-visible-trip-identity
pr: follow-up to #495
area: apps/web, docs
contract-impact: none
---

# Keep compact duplicate trip identities visible

## What changed

- `TripsPage.tsx` renders a disambiguating suffix by itself on compact calendar bars.
- Calendar identity E2E checks visible text fits at 390px and 375px; screenshot names match width.
- Updated the failure inventory and paired workspace UI documentation.

## Why

The merged #495 accessible names were distinct, but both visible 390px bars clipped their suffix.

## Validation

- Before fix: `CHANNEL=chrome LABEL=baseline-visible-identity pnpm --filter @trip/web e2e calendar-trip-identity-search` failed at 390px and 375px (`scrollWidth` 58–59px exceeded 45–48px); artifact `output/e2e/runner/2026-10-21T03-36-44-544Z.json`.
- After fix: `CHANNEL=chrome LABEL=mobile-identity-final pnpm --filter @trip/web e2e calendar-trip-identity-search` passed 33 assertions at 1440px, 390px and 375px, including `scrollWidth <= clientWidth`; artifact `output/e2e/runner/2026-10-21T03-44-06-809Z.json`.
- Phone screenshots: `output/playwright/calendar-trip-identity-search/mobile-identity-final/calendar-390.png` and `calendar-375.png`; fixture-backed local browser only.
- `pnpm --filter @trip/web test -- --maxWorkers=2`: 57 files, 642 tests passed.
- Web typecheck, lint; docs, paired docs, protected files, E2E selector/artifact guards; Prettier on changed files; added-comment check and `git diff --check` passed.

## Notes for the next person

Screenshots remain in ignored `output/` until attached to the PR. No live-provider, authentication or physical-device claim.
