# Route time conflict notice failure inventory

Written before the planner's route-time warning got its own message.

- A Chinese traveller sees the planner's English sentence "geography conflict on day 1: A to B needs 35
  minutes including a 15-minute buffer but only 15 are available" on the day timeline.
- An English traveller sees the internal "geography conflict" prefix.
- Place names that contain ":" or " to " split in the wrong place, so the notice names the wrong stops.
- The warning moves to the budget area instead of staying on its day.
- Other geography conflicts (route provider failures) disappear instead of staying visible.

Evidence: `route-time-conflict.test.ts` feeds the planner sentence through `placeConflicts` and checks
the day, the message key and its parameters, and that another geography conflict stays on its day.

## Unchecked routes

Written before the route-provider sentences got their own messages.

- When the maps provider fails (production has no working Google key), every day shows "geography
  conflict on day N: route provider failed; connection unverified" in English.
- The transport agent's "route provider unavailable for A → B" and the "A to B: no route returned" /
  "invalid route duration, fare or mode" / "driving estimate cannot verify public transport timing"
  sentences show raw English with the internal prefix.
- "A → B" and "A to B" forms name the wrong stops when a place name contains " to ".
- An unknown geography sentence is swallowed instead of staying visible on its day.

Evidence: the "unchecked routes" cases in `route-time-conflict.test.ts`.
