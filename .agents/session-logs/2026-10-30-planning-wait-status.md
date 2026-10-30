---
date: 2026-10-30
author: Claude Code
branch: feature/TP-166-planning-wait-status
pr: none
area: apps/web, docs
contract-impact: none
---

# Planning wait status moves forward and is translated

## What changed

- `components/chat/thinking-model.ts`: with no tool or specialist running, the live Think summary
  shows the latest finished specialist summary or coordinator step instead of "Preparing your request.".
- `components/chat/Disclosure.tsx`, `app/styles/thinking.css`: the running summary fades in on change.
- `components/chat/ThinkingRows.tsx`, `lib/i18n/locale.ts`: "Deep diving" is translated (深度求索中).
- `tests/e2e/planning-wait-status.e2e.mjs`, `docs/workspace-ui*.md`.

## Why

Slowed to Mindtrip-like timing, the status flipped back to "Preparing your request." between every
specialist and for the whole conflict check and assembly, so a 15-second wait looked like it restarted.

## Validation

- `planning-wait-status.e2e.mjs` against dev (mock data, stream relayed at 700 ms per event):
  before 5/10, after 10/10, English and Chinese.
- `npx vitest run tests/components/chat tests/lib` in apps/web: 458 passed.

## Notes for the next person

Kept out of PR #782 files. Map and title early feedback (Mindtrip's next step) need `useWorkspace`.
