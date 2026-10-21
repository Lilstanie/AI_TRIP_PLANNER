---
date: 2026-10-21
author: Codex
branch: fix/phone-trip-empty-targets
pr: 505
area: apps/web, docs
contract-impact: none
---

# Keep phone Trip empty-state actions at 44 px

## What changed

- Raised the rendered minimum height for both empty Trip actions in `apps/web/app/styles/phone-shell.css`.
- Added responsive browser assertions for both actions in `apps/web/tests/e2e/phone-shell.e2e.mjs`.
- Documented the 44 px target in English and Chinese workspace UI guides.
- Attached the 375×812 browser screenshot to PR #505.

## Why

The shared form-control rule overrode the phone-shell selector, leaving both buttons at 36 px until the phone rule gained sufficient priority.

Latest `origin/main` (`e3a54731`) was merged before final validation; this includes the already merged phone Mine focus work from #490.

## Validation

- Before fix, local Chromium measured both buttons at 36 px at 390×844, 360×800 and 375×812.
- `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e phone-shell --prod` — 536/537 checks; all six target assertions measured 44×44 px. The sole failure is the documented baseline phone-state “reload restores Map” check at 390×844 and 360×800; phone-map passed.
- `pnpm --filter @trip/web e2e phone-mine --prod` — passed, including keyboard activation and visible title focus at 390 and 360 px.
- Web typecheck, lint and test: passed; 57 files, 642 tests.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, changed-file Prettier and `git diff --check`: passed.

## Notes for the next person

The E2E run uses mock data and local Chromium; it does not establish live-provider or physical-device behavior. The one phone-state failure predates this change and is listed in `docs/e2e-known-failures.md`.
