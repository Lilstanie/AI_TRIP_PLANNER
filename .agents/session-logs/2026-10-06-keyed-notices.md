---
date: 2026-10-06
author: Claude Code
branch: refactor/keyed-notices
pr: none
area: apps/web, docs
contract-impact: none
---

# Notices carried as translation keys; attachment notices converted (#200)

## What changed

- New `apps/web/lib/i18n/notice.ts`: `Notice = { key; params? } | { raw }`, `noticeText(locale,
  notice)` and `NoticeError`. The type takes only dictionary keys and requires exactly the key's
  `{placeholders}`; a value may itself be a Notice. A value missing at run time leaves the
  placeholder visible.
- `lib/chat/attachments.ts`: rejection reasons are Notices; every thrown reason is a `NoticeError`.
  An unknown browser error now reads "the file could not be read" instead of its own message.
- `useComposerAttachments` holds `notices: Notice[]` instead of a translated string; `Composer`
  (`attachNotices`) translates once through `useLocale().notice()`, which now accepts a Notice or
  legacy English.
- The three attachment patterns left `NOTICE_PATTERNS`; the rest stay until #204/#205.
- Docs: `docs/workspace-ui.md` and its Chinese pair (pair re-recorded), `better-writing` skill.

## Why

The hook translated the reason and the composer passed the result through `interfaceNotice` again,
so each notice depended on English matching a regex. Keys checked by the compiler remove that.
`notice()` accepting both forms lets later producers convert one at a time.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`, `test` (46 files, 463 tests): pass.
- `pnpm verify:docs`, `pnpm verify:protected`, translate-docs `check-pairs.mjs`: pass.
- E2E against `next dev -p 3217` (mock tools): `workspace-chinese` and `ui-language`, all checks ok;
  evidence in `output/playwright/{workspace-chinese,ui-language}/`.

## Notes for the next person

- The workspace controller's `notice` state is never set to anything but `""`; it is left as a
  string for the workspace-verbs ticket.
- `Composer`'s `attachNotice` prop is now `attachNotices`.
