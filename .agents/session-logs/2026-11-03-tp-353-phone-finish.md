---
date: 2026-11-03
author: Claude Code
branch: fix/TP-353-ios-finish
pr: none
area: apps/web
contract-impact: none
---

# Phone: sign-in, planning progress, map sheet, trip home and warnings

## What changed

- `apps/web/app/styles/phone/finish.css` (imported last by `phone/index.css`): sign-in intro, team
  list, one-third map sheet height and hairline stop rows, one-row trip home composer, open-items row,
  grey warning labels.
- `PhoneTeamButton`: "Planning progress" title, title focus on open, team list open.
- `PhoneMapSheet`: a `third` snap that is the resting height.
- `OpenItemsBadge`: a "To check" line, shown only on phones.
- `AuthScreen`: Clerk `options.socialButtonsVariant: "blockButton"`; `auth.css` pins the social
  button border, because Clerk redefines `--border` inside it.
- `lib/i18n/notice.ts`: plain-copy keys share one `KeyedNotice` member, which removes the TS2590
  limit on new copy keys.
- New `phone-finish` E2E and failure list; `phone-map` checks the four heights; note and docs.

## Why

Batch 3 of the redesign Joey approved on 2026-11-03 (TP-353).

## Validation

- `phone-finish.e2e.mjs` 34/34; red/green and other runs are recorded in the PR.
- `pnpm typecheck` passes with 40 extra placeholder keys added temporarily.

## Notes for the next person

Clerk needs `CLERK_SECRET_KEY` to render locally; the sign-in change was checked against the live
page with the bundle option and stylesheet injected.
