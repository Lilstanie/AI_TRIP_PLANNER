---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-225-random-example-trips
pr: pending
area: apps/web
contract-impact: none
---

# Random example trips from many countries on the blank chat (TP-225)

## What changed

- `apps/web/lib/planning/quick-prompts.ts`: 19 example trips (family, solo, honeymoon, food, ski,
  backpacking, friends, aurora, multi-city; Asia, Europe, Americas, Oceania); `quickPrompts()` draws
  4 at random with one single-city, one stated-origin and one multi-city trip.
- Copy moved to `lib/i18n/messages/en-examples.ts` / `zh-examples.ts`, read by `exampleText()`.
- `components/chat/ChatPanel.tsx` draws in an effect whenever the chat becomes blank untouched.
- Tests and E2E selectors that clicked "Sydney · 4 days" now click the first chip.
- `docs/workspace-ui(.zh).md` describes the draw.

## Why

- The example catalogue stays out of `MessageKey`: adding ~30 keys there made `tsc` fail with
  TS2590 (the `Notice` union in `lib/i18n/notice.ts` is at its size limit).
- Drawing on the server would mismatch hydration, so the draw runs in `useEffect`.

## Validation

- `pnpm exec vitest run` in apps/web: 59 files, 639 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint` (warnings only), `node scripts/check-file-length.mjs`,
  `check-ui-copy.mjs`, `pnpm verify:e2e-selectors`: passed.
- `pnpm --filter @trip/web e2e chat-start-and-restore` twice: 11/11; drew Sydney → Singapore family
  and Melbourne → Sydney, both planned offline.
- Every example in both languages parsed offline into destination, dates, budget and group size.

## Notes for the next person

- `MessageKey` is near the TS2590 limit; large new copy groups need their own catalogue too.
