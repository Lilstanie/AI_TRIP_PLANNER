# Agent Note: one settle path for every plan change

Status: proposed
Owner: spec #259, ticket #263

## Problem

Since ticket #262, a remove, a move to Ideas, a scheduling and an arrow move are server operations, and the server
settles them with `settlePlan` (`apps/web/lib/trip/settle.ts`). The browser still runs `applyItemAction`
(`apps/web/lib/trip/item-actions.ts`) for details, notes and booked, and that path calls the same `settlePlan`, so the
browser computes the budget roll-up for an action that changes no price. Spec #259 asks that the client does not
compute totals.

The settle has one rule that is wrong for the traveller. `settlePlan` sums every item of the itinerary section, and an
activity with no day is an Idea. So moving a priced stop to Ideas leaves its price in the Estimated total, the bar and
the budget conflict, and the total does not change at once. The Idea's price still shows on its row.

The drawer, the trip list and the map read the same plan field, but only the drawer and the trip list show a total.
The map shows no budget total. The trip list reads the snapshot the workspace stores after each change
(`useWorkspaceStorage`, saved 350 ms after a change).

## Proposal

**The settle is the only place a total is computed.** `settlePlan` in `apps/web/lib/trip/settle.ts` rolls up each
section's estimate, the plan total, the budget conflicts and the version. Every path that changes a plan ends in it:
the server after every checked operation (`previewEdit`, `chooseCandidate`), and the browser after the item actions it
applies itself (details, note, booked). Nothing else sums a section or the plan. A new edit path that changes a price
must call it, and the conflicts and the total then read the same estimate.

**An Idea is not in the estimate.** In `settlePlan`, an itinerary activity with no day is left out of its section's
estimate and out of the conflict check that reads the same proposals. Its `estCost` stays on the item, so scheduling it
on a day puts its price back into the total. The rule is stated once in `settle.ts` and applies to every settle.

**The client runs the shared settle, and computes no total of its own.** Details, notes and booked keep their browser
path, because they change no price, time, leg or route; the settle they run is the same function the server runs, so
a total is never a second copy. No browser path adds or sums a price.

**The total the drawer shows is the total the server settled.** After a checked edit the drawer shows `plan.estTotal`
from the server's answer. The Your trips page reads the total from the stored snapshot of the same plan. The map shows
no total, so there is nothing to agree with; it is not given one here.

## Alternatives considered

- **Route details, notes and booked through the server too.** Rejected for this ticket. It adds three operation kinds
  and a round trip to changes that have no price effect, and it changes "apply at once" for the drawer's item menu,
  which the walkthrough checks. The shared settle already covers them, so the total cannot drift.
- **Remove the browser's settle call for details, notes and booked.** Rejected. The browser would then change a plan
  without its version or conflicts being settled, and a future price-changing action could skip the settle silently.
  Keeping the call costs one shared function and makes the rule hold for every browser action.
- **Count Ideas in the estimate and label them.** Rejected. The traveller asked for the total to match the plan
  (user story 6), and an Idea is not in the plan; a label would still leave the bar and the conflict out of step.
- **Change `costOf` in `packages/orchestrator/src/budget.ts`.** Rejected for now. It is shared with the chat workflow
  and the agent lab, which see no activities without a day; a change there would reach fixtures and unit tests for no
  traveller benefit. The settle applies the rule to the trip's own plan only.

## Acceptance criteria

1. Removing a priced stop lowers the Estimated total at once, from a day that keeps one stop and from a day that is
   then empty (`settle-path.e2e.mjs`, scenarios B, C and F).
2. Moving a priced stop to Ideas lowers the total at once; scheduling the Idea on a day raises it back by the same
   amount (scenarios D and E).
3. An arrow move leaves the total as it was, and the drawer shows the total the server answered (scenario A).
4. The open trip's card on Your trips shows the drawer's total after those changes (scenario G). The map shows no total.
5. No browser path sums a price: `apps/web/lib/trip/settle.ts` is the only function that rolls up a section or the plan.
6. `pnpm --filter @trip/web build` resolves `@trip/orchestrator/plan-totals` in the browser bundle.
7. `DATA_MODE=mock pnpm --filter @trip/web e2e` passes for the scripts listed in the ticket.
8. No unit tests are added; `packages/shared/src` is not changed.

## Risks

- A plan from chat with an activity that has no day would change its total on the first edit, by that stop's price.
  The chat planner schedules every activity it writes; the risk is recorded, not guarded.
- The Idea's row still shows its price while the total leaves it out. The row's price is the planner's estimate for
  that stop, not part of the total.
- The Your trips card reads the stored snapshot, which is saved 350 ms after a change, so it can show the previous
  total for that moment.

## Failure modes

Each row is a scenario in `apps/web/tests/e2e/settle-path.e2e.mjs`, or is named as not changed.

| #   | Situation                                                                               | Behaviour                                                                                                                            |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Remove a priced stop from a day with two stops                                          | The total falls by the stop's price at once; the day keeps one stop (B).                                                             |
| 2   | Remove a priced stop from a day with two stops, the other stop priced                   | Same as 1; the price of the stop left stays in the total (C).                                                                        |
| 3   | Remove the last stop of a day                                                           | The total falls by its price; the day shows no stop; no error (F).                                                                   |
| 4   | Move a priced stop to Ideas                                                             | The total falls by its price at once; the stop is listed under Ideas with its price on its row (D).                                 |
| 5   | Schedule an Idea on a day                                                               | The total rises by the Idea's price at once (E).                                                                                     |
| 6   | Arrow move (move earlier) of a priced stop                                              | The total is unchanged; the drawer shows the server's total (A).                                                                     |
| 7   | Refused edit (schedule with no room)                                                    | Plan and total unchanged; the alert names the stop. Not in this script; covered by check-entry-point.                               |
| 8   | Details, note or booked                                                                 | Applied in the browser; the shared settle runs; the total is unchanged. Covered by drawer-walkthrough.                              |
| 9   | Budget conflict after a move to Ideas drops the estimate under the budget               | The conflict is recomputed from the same estimate and clears with the total. Not in this script.                                    |
| 10  | Trip list card after the changes                                                        | Shows the drawer's total (G).                                                                                                        |
| 11  | Map                                                                                     | No budget total is shown on the map; nothing changes.                                                                                |
| 12  | Chinese interface                                                                       | No new text. Existing strings unchanged.                                                                                             |
| 13  | Undo of a move to Ideas (item undo)                                                     | Restores the plan as it was, with its total. Not in this script; covered by check-entry-point.                                       |
| 14  | Simulated (mock) data mode                                                              | The same rules; no provider request.                                                                                                 |

## Consequences

To be written when the code lands (promotion to implemented).
