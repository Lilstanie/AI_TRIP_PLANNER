---
date: 2026-10-22
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/budget-preset-keyboard
pr: none
area: apps/web
contract-impact: none
---

# Budget presets: roving tabindex and arrow keys (#516)

## What changed

- `apps/web/components/preferences/FactFields.tsx`: the four budget presets get a roving tabindex (checked preset, or the first when none is checked) and ArrowLeft/Right/Up/Down move focus and select with wrap-around.
- `apps/web/tests/e2e/budget-preset-keyboard.e2e.mjs`: new E2E covering tab stops, arrow movement, wrap-around, and click selection; writes `output/playwright/budget-preset-keyboard/`.

## Why

The radio group promised arrow-key behaviour that did nothing, and every preset was a Tab stop. The WAI-ARIA radio pattern needs one Tab stop with arrow keys.

## Validation

- `pnpm --filter @trip/web e2e budget-preset-keyboard` before the fix (fix stashed): 4/9 checks passed, exit 1.
- Same command after the fix: 9/9 checks passed, exit 0.
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no warnings.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed.
- `pnpm exec prettier --write` on both changed files.

## Notes for the next person

- Ran in a git worktree at `scratchpad/wt-516`, because the main checkout holds an untracked session log that differs from `origin/main`.
- `pre-push` `verify:docs` and `verify:protected` not run; the change touches no docs, shared contract or protected file.
