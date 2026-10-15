---
date: 2026-10-15
author: Claude Haiku 5.5 (/implement)
branch: fix/phone-chip-wrap
pr: none
area: apps/web
contract-impact: none
---

# Centre the text of wrapped example chips (#354)

## What changed

- `apps/web/app/styles/workspace-layout.css`: `.chat-empty__suggestions button` uses `text-align: center` instead of `left`.

## Why

A wrapped chip was left-aligned, so its second line sat off-centre among the centred single-line chips. The English label is unchanged on purpose: a change to the label text would break the Chinese dictionary keys in `workspace-messages.ts`. The issue's non-breaking-space suggestion is therefore not applied.

## Validation

- Browser, dev server, sign-in page (the chat is behind Clerk, so the chip was injected for inspection only): computed `text-align` is `center`, the 293px chip is 56px tall, no horizontal page overflow.
- `pnpm exec prettier --check apps/web/app/styles/workspace-layout.css`: pass.
- `pnpm --filter @trip/web typecheck`: pass.
- `pnpm --filter @trip/web test`: 57 files, 631 tests passed.

## Notes for the next person

- No automated test covers this: it is a CSS-only change and jsdom does not apply stylesheets. The E2E path for the empty chat is blocked by sign-in in this environment.
- The "9 days" split is still possible at other widths; the label needs a non-breaking space to fix it fully.
