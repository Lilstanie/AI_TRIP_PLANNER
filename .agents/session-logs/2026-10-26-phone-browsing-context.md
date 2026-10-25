---
date: 2026-10-26
author: OpenAI Codex
branch: feature/TP-99-phone-context
pr: none
area: apps/web, docs
contract-impact: none
---

# Share Map and Trip browsing context per trip

## What changed

- `useTripDay` and `lib/workspace/browsing.ts` now own one day and Stop context for phone Map and Trip.
- Saved Trips open in Trip and restore their own valid day and Stop; recent chats still open Chat.
- Revisions retain valid context, clear removed Stops and fall back from removed days.
- `phone-browsing-context.e2e.mjs` covers both Trips, reloads, revisions and 520/521 transitions in English and Chinese.
- `docs/workspace-ui.md` and its Chinese pair describe the interaction.

## Why

Map and Trip previously owned separate day state, so a later visit to a repeated place could open the
wrong day and switching Trips could reuse another Trip's context.

## Validation

- `pnpm --filter @trip/web e2e phone-browsing-context` - 114/114 checks passed in EN/ZH at
  390x844, 360x800 and 375x667, including 520/521 and 1440x1000 transitions; artifact:
  `output/e2e/runner/2026-10-25T14-12-49-025Z.json`.
- Focused workspace, layout and session tests - 3 files and 48 tests passed.
- Focused `Workspace.test.tsx` - 40 tests passed after the full suite exposed three unrelated
  cross-file isolation failures.
- `pnpm format:check-changed origin/main` passed after formatting the changed files.

## Notes for the next person

The earlier full-suite run had 3 of 642 tests fail across files while focused files passed; the
integration branch must rerun the final suite. Real-device keyboard and safe-area behavior remains
unverified. Fixtures do not prove live providers.
