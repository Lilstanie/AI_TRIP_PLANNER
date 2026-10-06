---
date: 2026-10-06
author: Claude Code
branch: refactor/workspace-session
pr: none
area: apps/web, docs
contract-impact: none
---

# Planning turns return a typed outcome; a pure `session()` applies it (#201)

## What changed

- New `apps/web/lib/workspace/session.ts`: `TurnOutcome` (`planned`, `needsInfo`, `asked`,
  `answered`, `failed`, `cancelled`), `requestTurn()` that only sends the request and reads the
  stream, and the pure reducer `session(state, event)` with the turn's reset rules.
- `useWorkspaceTransport.ts` no longer takes a dozen state setters; it calls `requestTurn` and
  dispatches the outcome. `Task` moved there from `workspace-helpers.ts`.
- `useWorkspaceController.ts` keeps the turn state in one `SessionState`; leaving a chat dispatches
  `left`. Field setters other callers still use are derived with `sessionField`.
- `apps/web/tests/lib/workspace/session.test.ts`: failure cases first, one per outcome, plus an
  aborted turn and a retry after failure.
- `docs/workspace-ui.md` and its Chinese pair describe the outcome and reducer.

## Why

The ticket names four outcomes; a fare answer (`answered`) and a cancel are also real endings
today, so they are outcomes too rather than hidden branches. Behaviour is unchanged.

## Validation

- `pnpm --filter @trip/web typecheck`, `lint`: clean. `test`: 46 files, 469 tests passed.
- `pnpm verify:docs`, `pnpm verify:protected`: pass.
- `itinerary.e2e.mjs` against a local dev server: all checks ok at desktop and phone.
- `DATA_MODE=mock conversation-scope.e2e.mjs`: 8/15. The failing checks need a model to learn the
  brief from chat (no model key here); the script posts straight to `/api/chat`, which this change
  does not touch.

## Notes for the next person

#206 (actions-only `useWorkspace`) can drop `sessionField` once callers dispatch events instead.
