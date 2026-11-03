---
date: 2026-11-03
author: Claude Code
branch: fix/TP-354-ios-leftovers
pr: none
area: apps/web
contract-impact: none
---

# Phone leftovers: focus targets, reply reveal, stop hint, weather line, trip rows

## What changed

- `app/styles/base.css`: the focus ring skips `tabindex="-1"`; non-interactive code-only focus
  targets drop the outline.
- `app/styles/chat/messages.css`: the word reveal uses `backwards` fill, so no filter stays on a word.
- `TimelineStop`: no orange "could not find" hint on a phone while the place search shows.
- `TripWeather` and `TripEditor`: a phone weather note is a one-line disclosure.
- `phone/finish.css`: weather fold and Mine trip rows on three lines.
- `phone-finish` E2E: five checks red on main; failure list; note, docs and the accessibility skill.

## Why

Leftovers from the final iOS check of the redesign (TP-354).

## Validation

- `phone-finish.e2e.mjs` red/green: 35/46 on main, 46/46 after; recorded in the PR.
- Simulator: old reveal blurred 20 s after a reply; fixed reveal sharp at 25 s.

## Notes for the next person

Screenshots from the iOS simulator lag behind taps; take a second one before judging a screen.
