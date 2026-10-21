---
date: 2026-10-19
author: Codex
branch: fix/party-breakdown-from-chat
pr: 447
area: apps/web/tests/e2e, docs
contract-impact: none
---

# Verify chat traveller counts in the browser

## What changed

- Added `party-breakdown-browser.e2e.mjs`: submit one adult and one child through the real mock chat API, inspect all five Who counters, then reload and reopen the saved trip.
- Documented this browser check in both API reference languages.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e party-breakdown-browser`: passed in 48 seconds; four desktop/phone and initial/reopened cases, no page errors.
- Runner: `output/e2e/runner/2026-10-19T11-53-17-530Z.json`.
- Screenshots and results: `output/playwright/party-breakdown-browser/`; visually inspected the 390px reopened Who sheet.
- The first attempt stopped before starting a server because this worktree lacked dependencies; `pnpm install --frozen-lockfile` succeeded before the passing run.

## Notes for the next person

- This update changes tests and documentation only. Earlier production-code regression results remain in the previous session log and PR evidence.
- Mock, signed-out local persistence only; no live model or Clerk sync coverage.
