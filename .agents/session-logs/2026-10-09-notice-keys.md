---
date: 2026-10-09
author: Claude Code (ticket #261 refactor run)
branch: refactor/notice-keys
pr: 258
area: apps/web, docs, .agents
contract-impact: none
---

# Notices read back as keys in the Trip drawer (#261, spec #259)

## What changed

- `apps/web/lib/i18n/locale.ts`: `AUTHORED_KEYS`, the English dictionary keys without a `|context` suffix.
- `apps/web/lib/i18n/notice.ts`: `keyOfAuthoredSentence()` reads an English sentence the app wrote back as its key
  and values; no match returns `undefined` and the sentence stays `{ raw }`.
- `apps/web/lib/trip/conflicts.ts`: `placeConflicts()` places such a sentence as its key: on the stop it names when that
  stop is on the day, else under the day title, else under the budget bar.
- `apps/web/tests/e2e/notice-keys.e2e.mjs` (new, red commit first); `drawer-walkthrough.e2e.mjs`: the travel-buffer
  `KNOWN_EXCEPTIONS.zh` entry is removed.
- Docs: `docs/workspace-ui.md` and `.zh.md` (Conflicts in place, i18n paragraph; pair recorded in
  `.agents/translation-pairs.json`). Note: `implemented/feature/2026-10-09-notice-keys.md` (promoted from proposed).

## Why

A plan saved before its notices were keyed holds the travel-buffer sentence only in English (`conflictsWith`, which
the chat reads). The drawer showed it raw under the day title in Chinese. The fix reads it back as its key and places
it as a keyed notice is placed; the stored shapes and the chat's English copy are unchanged. On this tip a keyed
notice already sat on its destination stop, so the new E2E seeds the legacy shape to reproduce the day-title line.

## Validation

- Red before the code: `notice-keys` 12 of 60 checks failed, all in the legacy phase (English under the day title).
- `cd apps/web && npx tsc --noEmit`: exit 0. `pnpm --filter @trip/web lint`: exit 0, no warnings.
- `pnpm --filter @trip/web test`: exit 0, 581 passed (base count).
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline workspace-chinese drawer-walkthrough plan-revision notice-keys`:
  exit 0, all five scripts ok; drawer-walkthrough 194 checks, 0 failed, 2 known exceptions (`在 Google 地图打开`).
- `node scripts/verify-docs.mjs`: exit 0. `check-pairs.mjs`: exit 0, 24 pairs. `verify-protected-files.mjs origin/main`: exit 0.
- Prettier `--check` on the changed files: exit 0.

## Notes for the next person

- A keyed notice whose stop is removed or moved to Ideas on the client is stored and not shown (Agent Note row 13).
- A legacy sentence lists in plan-conflict order inside its stop, so it can follow an overlap marker.
- Next's dev runs rewrite `apps/web/tsconfig.json`; revert it before committing.
