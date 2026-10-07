---
date: 2026-10-06
author: Claude Code
branch: refactor/keyed-notices-contract
pr: none
area: apps/web, docs
contract-impact: api
---

# Every workspace notice is a keyed Notice; the English-to-key lookup is deleted (#205)

## What changed

- `useLocale().notice()` takes only `Notice | undefined`; `interfaceNotice`, `NOTICE_PATTERNS` and
  the exact-match fallback are gone from `apps/web/lib/i18n/locale.ts`.
- `lib/i18n/notice.ts` adds `noticeBody`, `failureNotice` and `errorNotice`. Places, account,
  chat (400s and `error` frames), routes and preview-edit routes answer `{ error, notice }`.
- `lib/integrations/google.ts` throws `NoticeError` (`GoogleRequestError` extends it); unavailable
  `RouteResult`s carry `notice`. Session `error`/`errors`, `briefErrors`, storage, map, location,
  settings, preference and item-action notices are Notices; about 35 new Chinese entries.
- Docs: `docs/workspace-ui.md` + `.zh.md`, `better-writing` skill, the edit-preview note's facts, and
  a new [keyed notices note](../notes/implemented/architecture/2026-10-06-keyed-notices-everywhere.md).

## Why

With `notice()` typed to `Notice`, the compiler found each string producer. Several English
sentences never had a pattern ("Note saved.", "Removed “x”." for learned rows, Google errors) and
showed in English in Chinese. A body with `error` but no `notice` is shown raw, not guessed at.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`, `test` (51 files, 544 tests): pass.
- `pnpm verify:docs`, `pnpm verify:protected`: pass.
- E2E against `next build` + `next start` with `DATA_MODE=mock`: `workspace-chinese` 38 ok,
  `ui-language` 15 ok, `settings` 36 ok. Under `next dev` the same scripts timed out intermittently
  on first-page waits; a probe showed the page fine, so that was dev-server timing.

## Notes for the next person

- Agent progress errors, Agent Lab text and blockers saved on a plan stay English strings.
- Learned-preference row text ("Flights: arranged by you, not planned") is still English content.
