---
date: 2026-10-19
author: Codex
branch: fix/chinese-workspace-controls
pr: none
area: apps/web
contract-impact: none
---

# Send localized quick prompts from Chinese chat

## What changed

- `ChatPanel` sends the prompt through the active locale translator.
- The ChatPanel regression check now expects Chinese content and verifies traveller count and budget.

## Why

Issue #387 showed that English example text caused an English assistant reply in an otherwise Chinese workspace. The existing translations already cover the prompt strings.

## Validation

- Red check: `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @trip/web exec vitest run tests/components/chat/ChatPanel.test.tsx` failed against the old English-send behavior.
- Green check: same focused command passed, 18 tests.
- `pnpm --filter @trip/web test` passed, 57 files and 632 tests.
- `CHANNEL=chrome pnpm --filter @trip/web e2e chinese-locale-controls` passed 10 browser assertions; artifact `output/e2e/runner/2026-10-18T21-58-11-511Z.json`.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` passed.
- `pnpm format:check-changed origin/main`, `pnpm verify:docs`, and `pnpm verify:protected` passed on the final tree.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` passed on the final tree.

## Notes for the next person

The behavior is already described in `docs/workspace-ui.md` and its Chinese pair. Mock browser requests only; no live provider call was made.
