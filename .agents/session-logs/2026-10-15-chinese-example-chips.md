---
date: 2026-10-15
author: Claude Haiku 5.5 (/implement)
branch: fix/chinese-example-chips
pr: none
area: apps/web
contract-impact: none
---

# Translate the example trip chips in the Chinese interface (#355)

## What changed

- `apps/web/components/chat/ChatPanel.tsx`: the chip text renders `t(label)`, matching the `key` and `title` already translated on the same line.
- `apps/web/tests/components/chat/ChatPanel.test.tsx`: new test, written red first, that sets the Chinese language and checks the chip reads `悉尼 · 4 天` while the sent prompt stays English.

## Why

The Chinese strings already existed in `workspace-messages.ts`; only the rendered text skipped `t()`. The fix is the one-line change, so no dictionary edit was needed.

## Validation

- Red: the new test failed with `Unable to find role="button" and name "悉尼 · 4 天"` before the fix.
- Green: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/components/chat/ChatPanel.test.tsx` → 18 passed.
- `pnpm --filter @trip/web typecheck`: pass.
- `pnpm --filter @trip/web lint`: pass.
- `pnpm exec prettier --check` on both changed files: pass.
- `pnpm --filter @trip/web test`: 57 files, 632 tests passed.

## Notes for the next person

- The new test clears its localStorage key only on success. A failing assertion leaves the Chinese setting behind for later tests in that file.
- The E2E in `phone-mine` still cannot reach `.phone-mine` in this environment (see the #353 session log); this change is covered by the component test only.
