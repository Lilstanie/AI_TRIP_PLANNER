---
date: 2026-10-16
author: Claude Opus 5.5
branch: fix/progress-line-outcome
pr: pending
area: apps/web
contract-impact: none
---

# Record each turn's outcome so the progress line tells the truth (issue #372)

## What changed

- `apps/web/lib/workspace/workspace.ts`: `Message` gains `outcome?: "planned" | "asked"`.
- `apps/web/lib/workspace/session.ts`: a planned turn records `planned`; a needs-info or ask-user turn records `asked`.
- `apps/web/components/chat/thinking-model.ts`, `ThinkingProcess.tsx`, `MessageItem.tsx`: with no counts, the summary reads Trip plan ready, Need more details, Needs attention (failed) or Done.
- `apps/web/lib/i18n/workspace-messages.ts`: "Need more details" / 还需要一些信息. "Done" reuses the existing key (完成).
- `apps/web/tests/lib/workspace/session.test.ts`: two expectations now include `outcome: "planned"`.
- `apps/web/tests/e2e/progress-line-outcome.e2e.mjs`: new E2E. `docs/workspace-ui.md` and `.zh.md`: the four labels.

## Why

Decided with the owner: the progress view could not tell whether a turn built a plan. The flag lives on the web-only `Message` type, not the shared contract. A flight Q&A turn records no outcome, so it reads Done.

## Validation

- `node tests/e2e/run.mjs progress-line-outcome` without the fix: 4/8 (clarifying turn, saved message and Chinese all said Trip plan ready).
- Same command with the fix: 8/8.
- `pnpm --filter @trip/web test`: 632 passed. `typecheck`, `lint`: exit 0.
- `pnpm verify:e2e-artifacts`, `verify:e2e-selectors`, `verify:pairs`, `verify:docs`: pass.

## Notes for the next person

- A planning turn usually has tool counts, so its line shows the counts rather than Trip plan ready.
- The agreed Chinese for Done was 已完成; the shared `Done` key reads 完成.
