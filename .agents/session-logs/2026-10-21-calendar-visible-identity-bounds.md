---
date: 2026-10-21
author: Codex
branch: fix/calendar-visible-trip-identity
pr: 499
area: apps/web
contract-impact: none
---

# Keep compact calendar trip identities readable

## What changed

- Rendered a dedicated no-wrap label inside each trip calendar bar.
- Increased compact phone labels to 12px.
- Extended the browser journey to measure visible glyph bounds within bar content at 390px and 375px.
- Updated the failure inventory for clipped or too-small phone labels.

## Why

The earlier phone screenshot showed clipped destination text despite distinct accessible names. Compact bars now show the unique suffix directly.

## Validation

- `CHANNEL=chrome LABEL=mobile-identity-bounds-final pnpm --filter @trip/web e2e calendar-trip-identity-search` — passed at 1440px, 390px and 375px; artifact `output/e2e/runner/2026-10-21T04-03-45-554Z.json`; screenshots under `output/playwright/calendar-trip-identity-search/mobile-identity-bounds-final/`.
- `pnpm --filter @trip/web test -- --maxWorkers=2` — 57 files, 642 tests passed.
- Web typecheck and lint passed.
- Docs, pairs, protected-file, E2E selector/artifact, changed-file formatting, comment-policy and `git diff --check` guards passed.

## Notes for the next person

Screenshots and logs remain in ignored `output/` pending the requested upload/quote; fixture-backed browser evidence only.
