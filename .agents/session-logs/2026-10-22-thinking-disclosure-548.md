---
date: 2026-10-22
author: Codex
branch: fix/collapsed-thinking-disclosure-548
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep raw orchestration text inside an expanded reasoning disclosure

## What changed

- `thinking-model.ts` keeps the turn and streaming subagent summaries on localized live progress.
- `ThinkingRows.tsx` labels collapsed reasoning rows with localized `Thinking`.
- Added deterministic EN desktop and ZH phone streamed-event browser evidence, plus a pre-code failure inventory.
- Updated the Thinking design docs in English and Chinese; aligned existing assertions with the new contract.

## Why

The turn summary, nested subagent summary, and collapsed reasoning row each rendered raw model reasoning. Parent disclosure state did not protect nested collapsed rows.

## Validation

- Baseline `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e thinking-disclosure`: reproduced raw text in EN and ZH before the fix.
- Final `pnpm --filter @trip/web test`: 57 files and 642 tests passed. A prior run had one unrelated workspace lifecycle failure; that spec passed alone and on the final full run.
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e thinking-disclosure`: 23 EN 800x600 and ZH 390x844 checks passed; simulated events, not a live planner run. Screenshots: `output/playwright/thinking-disclosure/`.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:pairs`, `pnpm verify:docs`, `pnpm verify:protected`, and Prettier check: passed.

## Notes for the next person

The browser reports a pre-existing `/favicon.ico` 404; no application console errors or failed requests occurred. The development fixture is synthetic and does not verify a live provider run.
