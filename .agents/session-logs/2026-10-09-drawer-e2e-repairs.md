---
date: 2026-10-09
author: Claude Code (spec #259 integration run)
branch: feature/trip-drawer-no-confirmations
pr: 258
area: apps/web (e2e scripts, phone stop editor style)
contract-impact: none
---

# E2E repairs after the one-day drawer (#233, #259)

## What changed

- `display-currency` and `trip-display-currency`: the drawer no longer has specialist section rows, so the checks
  read every amount in the Trip panel and the stored plan's sections instead of `.section__row`.
- `phone-shell`: the phone Trip tab is checked by its "Trip timeline" region, not the removed Itinerary tab.
- `phone-state`: the stop editor walk targets the last stop of a day. The last stop in the list can be an Idea, which
  has no Edit details, and the Mine tab's trip list also has "Actions for" menus.
- `itinerary`: after Move to another day the script waits for the stop on Day 2, because the move goes through the
  server check, which a cold dev server compiles on first use.
- `timeline`: waits for the data-mode toggle or the phone Mine tab, so phones no longer sit out a 30 s timeout
  (248 s to 126 s).
- `app/styles/trip.css`: while the phone keyboard is open, a stop editor's action row is sticky at the bottom of the
  Trip list. The place card made the editor taller than the space above the keyboard on 360 x 800, which hid Save.
  This restores the behaviour `docs/workspace-ui.md` already describes.

- Code review fix, `lib/workspace/session.ts`: the workspace counts the timeline changes still in the plan instead
  of keeping one flag. Undo takes back one change, so after two changes and one Undo a chat replan said nothing
  about the first change it replaced. `check-entry-point` scenario 7 covers both orders (red before the fix).

## Validation

`DATA_MODE=mock pnpm --filter @trip/web e2e display-currency trip-display-currency itinerary phone-shell phone-state`
all pass; `timeline` passed in 126 s; `check-entry-point` passes; `pnpm --filter @trip/web test` 581 pass.

## Known limitations

- `installable-app` hangs waiting for the service worker, and `liquid-glass` and `thinking-orb` also fail on
  `origin/main`; they are not changed here.
