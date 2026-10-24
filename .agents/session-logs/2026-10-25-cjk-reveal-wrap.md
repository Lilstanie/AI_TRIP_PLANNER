---
date: 2026-10-25
author: Claude Haiku 5.5 (scheduled triage task)
branch: fix/cjk-reveal-wrap
pr: none
area: apps/web
contract-impact: none
---

# Chinese assistant replies wrap at character boundaries

## What changed

- `apps/web/app/styles/messages.css`: removed `display: inline-block` from `.msg-reveal__word`, so reveal word spans are inline and a long Chinese run can break between characters. The reveal animation is unchanged.
- `apps/web/tests/e2e/cjk-reveal-wrap.e2e.mjs`: new E2E. It runs the Chinese example chip at 390 px, then asserts every reveal word span computes to `inline`, and none overflows its message body.

## Why

Each word span was an unbreakable inline-block. Chinese text has no spaces, so a whole run became one box that could not wrap, leaving short tokens alone on a line (issue #662).

## Validation

- `pnpm --filter @trip/web e2e cjk-reveal-wrap` on unchanged `origin/main`: FAIL, 31 spans all `inline-block`.
- Same command on this branch: ok, 0 non-inline spans, 0 overflowing spans, no page errors. Screenshot: `output/playwright/cjk-reveal-wrap/run/zh-reply.png`.
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0.
- `pnpm exec prettier --check` on the two changed files: exit 0.
- `pnpm verify:e2e-selectors`: exit 0.
- `pnpm verify:e2e-artifacts`: exit 0.
- `pnpm --filter @trip/web exec vitest run tests/components/chat/MessageItem.test.tsx`: 15 passed.

## Notes for the next person

- The overflow assertion passed on `origin/main` as well, so only the `inline` check discriminates the fix. Tighten it if a future reply fixture exposes overflow.
- Not checked: a real screen reader, and Chinese lines at widths other than 390 px.
