---
date: 2026-10-28
author: Codex
branch: feature/trip-export-534
pr: 742
area: apps/web
contract-impact: none
---

# Preserve empty trip days in exports

## What changed

- Include every trip day in copied text and disambiguate calendar event identifiers.
- Extend the export browser scenario and failure inventory.

## Validation

- `pnpm --filter @trip/web e2e trip-export`: passed, desktop and phone.
- `PATH=/Users/joey/.nvm/versions/node/v24.18.0/bin:$PATH pnpm --filter @trip/web test`: 645 passed.
- Typecheck, lint, docs and protected-file checks passed before this log.

## Notes for the next person

- Node 26 produced four existing date-format assertion failures; Node 24 passed.
