---
date: 2026-10-30
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web, docs
contract-impact: none
---

# Trip home reuses the Chat composer

## What changed

- `TripHomeChats.tsx` uses Chat's `Composer` with its shared appearance, growth and mentions.
- `useWorkspace.ts` and `WorkspaceView.tsx` forward home-draft attachments to the explicit
  Trip request and saved message; the old independent textarea and button styling is removed.
- Shared Composer uses browser content sizing where available, retaining the existing measurement
  fallback; this avoids stale height measurements after clearing multiline text.
- Updated the failure inventory, first-send browser journey, bilingual workspace docs and
  implemented first-send Agent Note.

## Validation

- `pnpm --filter @trip/web e2e run trip-home-send`: passed in an isolated production fixture server.
  Covers shared controls, multiline growth, keyboard mentions, attachment forwarding and storage,
  first send, IME, concurrency, navigation and phone scroll/focus in English and Chinese.
- `pnpm --filter @trip/web typecheck`: passed.
- Web native `next lint` on the four changed TSX files: passed.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`: passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs`: passed.

## Notes for the next person

- Final evidence: `output/e2e/local-test-cli/2026-10-30T02-38-11-819Z-4415-hxefli/`.
- Earlier production runs failed the new empty-height assertion; retained at
  `output/e2e/local-test-cli/2026-10-30T02-28-32-910Z-3224-u1g0qn/`.
- A dev-proxy attempt failed HMR/token setup; broad root lint scanned generated builds and
  failed. Neither is represented as a passing check. Scoped web lint above passed.
- Browser viewports and fixture requests do not establish live-provider or physical-keyboard behavior.
- The independent Calendar time-axis spec finding remains separate and unresolved.
- Changes remain on the PR #782 integration branch; no remote merge or branch deletion.
