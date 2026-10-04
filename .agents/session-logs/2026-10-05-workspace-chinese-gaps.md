---
date: 2026-10-05
author: Claude Code
branch: feature/workspace-chinese-148
pr: 165
area: apps/web
contract-impact: none
---

# Translate the last authored workspace strings left in English for #148

## What changed

- `lib/i18n/workspace-messages.ts`: Chinese entries for the restored-workspace welcome line and the
  browser-storage-full notice. The notice already goes through `notice()`, so the entry is enough.
- `lib/workspace/message-chrome.ts` exports `WELCOME_MESSAGE`; `workspace-helpers.ts` seeds it and
  `chat/MessageItem.tsx` shows it through `t()`. Other agent text stays verbatim.
- `chat/MessageItem.tsx` formats the message clock with the interface locale instead of `en-AU`.
- `tests/e2e/workspace-chinese.e2e.mjs`: a zh-CN browser whose storage refuses writes sees the
  storage notice in Chinese (screenshot `1440-storage-full.png`).

## Why

The welcome line is stored in the transcript in English, so it is matched at render time instead
of translated when it is written; a saved transcript then follows a later language switch.

## Validation

- `node apps/web/tests/e2e/workspace-chinese.e2e.mjs` against `DATA_MODE=mock pnpm --filter
  @trip/web dev`: 27/27 ok, artifacts under `output/playwright/workspace-chinese/`.
- `pnpm --filter @trip/web exec tsc --noEmit -p .`: 0 errors. Web tests: 451 passed. Web lint: clean.

## Notes for the next person

- The example-trip chips ("Sydney · 4 days") are still English in Chinese mode.
