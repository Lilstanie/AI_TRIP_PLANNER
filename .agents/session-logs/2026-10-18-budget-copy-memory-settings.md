---
date: 2026-10-18
author: Codex
branch: fix/issues-398-401-budget-copy-memory
pr: none
area: apps/web, docs
contract-impact: none
---

# Hide unavailable memory controls and make budget edits readable

## What changed

- Removed the nonfunctional long-term memory switch and promise from Settings; kept the stored field.
- Made budget-only trip edits post a concise, localized user message with the trip's currency.
- Updated English and Chinese workspace docs and the implemented settings note.
- Added focused browser E2E coverage and retained screenshots and result summaries.

## Why

The settings UI should not promise memory that does not exist, and a one-field edit should not
restate the full trip as though the traveller wrote machine-generated data.

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= node apps/web/tests/e2e/settings-memory-hidden.e2e.mjs` — 16/16 passed; screenshots and summary in `output/playwright/settings-memory-hidden/`.
- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= node apps/web/tests/e2e/sheet-budget-copy.e2e.mjs` — 8/8 passed; screenshots and summary in `output/playwright/sheet-budget-copy/`.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` — passed.
- `pnpm format:check-changed origin/main` — all 68 changed files formatted.
- `git diff --check` — passed.

## Notes for the next person

The first memory E2E attempt timed out waiting for the page `load` event during cold compilation;
the script now waits for `domcontentloaded` and then for the workspace, and the full rerun passed.
Account-synced `assistant.memory` remains in the existing settings schema; browser E2E verified the
saved local value and Settings behavior in English and Chinese on desktop and phone.
