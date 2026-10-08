---
date: 2026-10-08
author: Claude
branch: feature/drawer-e2e-241
pr: none
area: apps/web, docs
contract-impact: none
---

# One E2E walk through the finished Trip drawer (#241, part of #233)

## What changed

- `apps/web/tests/e2e/drawer-walkthrough.e2e.mjs` (new): plans a mock trip and walks the Trip drawer at
  1440x1000 and 390x844, in English and Chinese. It checks the #233 rules (no status or confirm labels,
  leg mode and duration with no button, leg re-timing, applied time edits with Undo, overlap marking,
  stay Alternative, travel tips fold, restaurant from Ideas, no horizontal scroll, nowrap stop times,
  no console errors) and writes `output/playwright/drawer-walkthrough/<LABEL>/summary.json` with screenshots.
- `apps/web/components/trip/timeline/useTimelineEdits.ts`: product fix. After an applied time, move or
  leg edit, the workspace re-verified the day and replaced the plan, which dropped the Undo step once legs
  existed. `touchedDays()` now records every day the server routed in the edit as checked, so the
  verify does not run again.
- `docs/workspace-ui.md` and `.zh.md`: the applied-edit paragraph, and a "Drawer walkthrough" section
  (command, artifact, reload behaviour). Pairs recorded with `check-pairs.mjs --record docs/workspace-ui.md`.

## Why

- A reload starts a blank chat and leaves the saved trip in Trips (`restoreWorkspace`, by design). The
  walk's reload check therefore reopens the trip from Trips, not from the drawer. The tips fold is read
  from `trip-tips-folded:<tripId>`.
- The Chinese check is an exact-string list (`KNOWN_EXCEPTIONS.zh`), never a pattern. It holds the
  travel-buffer message (open item, see below) and the brand label "在 Google 地图打开".

## Validation

- `pnpm --filter @trip/web exec tsc --noEmit` (same as `cd apps/web && npx tsc --noEmit`): exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no ESLint warnings or errors.
- `pnpm --filter @trip/web test`: exit 0, 50 files, 581 tests passed.
- `node scripts/verify-docs.mjs`: exit 0. `check-pairs.mjs`: 24 pairs, exit 0.
  `node scripts/verify-protected-files.mjs origin/main`: exit 0.
- Prettier `--check` on the four changed source and doc files: exit 0.
- `DATA_MODE=mock pnpm --filter @trip/web e2e drawer-walkthrough`, run twice in a row, both exit 0:
  - `output/e2e/runner/2026-10-08T21-12-59-903Z.json`: artifact `21-13-11-207Z`, 194 checks, 0 failed, 8 known exceptions.
  - `output/e2e/runner/2026-10-08T21-22-16-137Z.json`: artifact `21-22-27-371Z`, 194 checks, 0 failed, 8 known exceptions.
  - The 8 known exceptions are the two exact strings above, repeated across the zh stages; stubbed place names and addresses count as plan text.
- Skipped: none. The walk runs in mock mode with stubbed places and simulated legs; no MAPS_API_KEY was used.

## Notes for the next person

- Open item (product, not fixed): `lib/trip/trip-edit.ts:477` writes the travel-buffer message in English
  (`noticeText("en", blocker)`), so the zh drawer shows it in English. It is the first `KNOWN_EXCEPTIONS.zh` entry.
- Product finding (not fixed): `trip-edit.ts:506-507` attaches each buffer message to every activity of
  the affected day, so the same message shows on all three stops of Day 1. The overlap marker itself is
  correct: only the two overlapping stops carry "Overlaps ... on this day."
- Open decision: the green "Place confirmed" tag on saved places is still shown in English. The walk
  does not count it as a confirm badge (it is not in `CONFIRM_TAG`), and it is counted in the summary
  as `placeConfirmedTags` (en only; zh records null).
- The walk excludes Next's own cancelled `_rsc` prefetches from "request failed". Other failed requests still fail it.
- The walk writes into `apps/web/output`, which `next dev` watches. Run it through the runner; a manual
  dev server on another port can fail the first wait during a recompile.
