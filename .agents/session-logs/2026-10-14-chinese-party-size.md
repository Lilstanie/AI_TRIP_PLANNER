---
date: 2026-10-14
author: Codex
branch: fix/chinese-party-size
pr: none
area: apps/web
contract-impact: none
---

# Verify Chinese party size through chat and the trip view

## What changed

- Added `apps/web/tests/e2e/chinese-party-size.e2e.mjs` for a Chinese party-size request at desktop and phone widths.
- The browser journey checks the saved brief, dining price detail, visible trip count and browser errors; it saves screenshots and plan artifacts under `output/playwright/chinese-party-size/`.

## Why

The integration base already parsed Chinese counts and passed the offline chat tests. This adds the missing browser-to-priced-plan acceptance evidence without duplicating production behavior.

## Validation

- `pnpm --filter @trip/web e2e chinese-party-size` — passed, 8 assertions across desktop and phone; artifacts under `output/playwright/chinese-party-size/`.
- Earlier run with a 2,400 AUD budget failed only the positive dining-cost assertion because the budget allocation was zero; raised the fixture budget to 24,000 AUD and reran successfully.
- `pnpm --filter @trip/orchestrator test -- chat-offline.test.ts chat.test.ts` — 2 files, 60 tests passed.
- `pnpm verify:docs` and `pnpm verify:protected` — passed.
- `pnpm exec prettier --write apps/web/tests/e2e/chinese-party-size.e2e.mjs` — formatted.

## Notes for the next person

No production parser change was needed at integration tip `f5ab48f0`; no docs pair or Agent Note needs updating. No push or GitHub state change.
