---
date: 2026-10-22
author: Claude Code
branch: fix/signed-out-data-mode-chip
pr: none
area: apps/web, docs
contract-impact: none
---

# Signed-out data-mode chip is focusable and says why live data is unavailable

## What changed

- `apps/web/components/workspace/DataModeToggle.tsx`: when `liveAvailable` is false the chip uses
  `aria-disabled` instead of `disabled`, ignores activation, and its hidden text gives the sign-in
  reason instead of "Activate to switch to live provider data" (#538). The `disabled` prop
  (busy) still disables it.
- `apps/web/app/styles/workspace-layout.css`: the aria-disabled chip keeps the disabled look.
- `apps/web/lib/i18n/workspace-messages.ts`: Chinese text for the new hidden sentence.
- `apps/web/tests/e2e/signed-out-data-mode-chip.e2e.mjs`: rewrites `/api/data-mode` to
  `liveAvailable: false`, checks focus, text and that Enter/click keep mock data; the unmodified
  response is the control.
- `docs/api.md` and its Chinese pair: the toggle was never hidden; describe the current state.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e signed-out-data-mode-chip` with the source change
  stashed: exit 1, 5/7 (disabled and unfocusable; text says "Activate"). With it: exit 0, 7/7.
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

Playwright treats `aria-disabled` as not actionable, so the E2E clicks with `force: true`.
