---
date: 2026-10-16
author: Claude Opus 5.5
branch: fix/settings-tabs-wrap
pr: pending
area: apps/web
contract-impact: none
---

# Wrap the Settings tabs on phones (issue #396)

## What changed

- `apps/web/app/styles/settings.css`: at 640 px and below the section tabs wrap instead of scrolling sideways.
- `apps/web/tests/e2e/settings-tabs-wrap.e2e.mjs`: new E2E at 375 and 390 px in English and Chinese, plus a desktop check.
- `docs/workspace-ui.md` and `.zh.md`: the phone section list wraps.

## Why

Decided with the owner: every setting visible at once on a phone, rather than a scroll cue.

## Validation

- `node tests/e2e/run.mjs settings-tabs-wrap` without the fix: 13/17; Language & region and Connected accounts sit outside the dialog in English, 已连接账户 in Chinese, at both widths.
- Same command with the fix: 17/17; desktop tabs stay in one column.
- `pnpm --filter @trip/web lint`: exit 0. `pnpm verify:e2e-artifacts`, `verify:e2e-selectors`, `verify:pairs`, `verify:docs`: pass.

## Notes for the next person

- `.agents/translation-pairs.json` also changes in the #357 and #356 branches; re-record `docs/workspace-ui.md` after each merge.
