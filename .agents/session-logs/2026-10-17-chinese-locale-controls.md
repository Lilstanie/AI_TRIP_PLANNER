---
date: 2026-10-17
author: Codex
branch: fix/chinese-ui-language-377-378-387
pr: none
area: apps/web, docs
contract-impact: none
---

# Localize workspace data and example controls

## What changed

- Localized data-mode tooltip titles in `DataModeToggle.tsx`.
- Translated example prompt text through locale messages while preserving generated dates.
- Used the displayed localized title for untitled-chat action names.
- Added `chinese-locale-controls.e2e.mjs` and paired workspace UI documentation.

## Why

- The selected interface language should cover authored workspace controls and examples without changing English wording or prompt values.

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= pnpm --filter @trip/web e2e chinese-locale-controls` — passed at 1440×1000 and 390×844; screenshots and report retained under `output/playwright/chinese-locale-controls/`.
- Browser run started from base `1e7d8a0`; artifacts: `desktop-zh.png`, `phone-zh.png`, `phone-en.png`, and `report.json`.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` — passed.
- `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, `git diff --check` — passed.
- `pnpm exec prettier --check` on all changed source, E2E, documentation and session-log files — passed.

## Notes for the next person

- No known follow-up; no push or PR was created.
