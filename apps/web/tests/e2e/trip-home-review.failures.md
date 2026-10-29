# Trip home review fixes: failure inventory

Written before the fixes (review of spec #765). Each line is a way the change could fail.

- A phone window widened while the Trip home is open drops the home, or keeps the phone's Mine view, so the Itinerary card opens the Trip panel on a view that does not exist on desktop.
- A stale trip id survives into the conversation or Trips page after a view switch and brings the home back later. Reached only through the layout state, so it is covered by the widening path above and the existing Back checks.
- Empty Enter or a disabled Send still creates a Chat or moves the trip snapshot's saved time forward.
- A chat date that cannot be parsed throws while the home renders. A stored catalog cannot hold one (the parser rejects it), so this is a guard only.
- A place lookup aborted while its body is read is treated as an empty answer instead of an abort, and a later lookup is lost or an error is logged.
- Deleting a trip from its home navigates twice, or the effect that leaves a missing home re-runs on every render.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-review --prod`. The browser catalog holds one Sydney trip with a chat. The script widens a phone window on the Trip home and presses empty Enter three times, and writes screenshots and `summary.json` under `output/playwright/trip-home-review/`.
