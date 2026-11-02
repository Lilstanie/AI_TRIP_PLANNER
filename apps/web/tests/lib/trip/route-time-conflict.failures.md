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
