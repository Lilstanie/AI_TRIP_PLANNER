# Agent Note: Specialist content moves into the one day view

Status: implemented
Owner: spec #233, ticket #239

## Problem

The Trip drawer still renders each specialist as a card under the day view: Day plan, Getting around, Stay,
Destination guide and Food & dining. The one day view (`implemented/feature/2026-10-08-one-day-trip-view.md`)
already shows the stops, the day's flights and ground hops, and the night's check-in, so the same facts
appear twice. The stay and flight choices, with their Alternatives, live in a separate card a traveller has to
find. The destination guide's advice and the restaurants the dining specialist found cannot be reached from
the day at all.

This supersedes one part of the one day view note: its decision that the trip sections (flights, stays, fares)
sit after Ideas as the surface for stay and fare choices. Those choices move onto the day's own rows. The rest of
that note stands.

## Decision

Stop rendering the five specialist cards. Plan sections stay in the data; only their card rendering goes.
No model-written working notes (section summaries, assumptions) are shown.

- Each day ends with the night's stay row. A stay with `nights` above 1 gives one row per night, so the day
  before checkout still has one. Opening a row shows the stay card (rating, check-in and check-out, rooms and
  nights, nightly price, cancellation terms, the source disclosure) with its Alternatives. Taking one calls the
  same `choose` edit the card made.
- Day 1 starts with the flight in. The last day ends with the flight out. The planner searches the arrival
  flight as a round trip and records the return date on that item, so the flight out shares the arrival's
  selection and its Alternatives swap the same fare. Opening a flight row shows the flight card with its
  Alternatives. Inter-city flights are rows on their day. Timed ground hops stay as rows, as they are now.
- The destination guide's advice (customs, safety, entry and health, weather and packing, and attractions) is
  a collapsible block at the top of the day view. It starts expanded and remembers, per trip, whether the
  viewer folded it, in `localStorage` wrapped in try/catch. Without storage it starts expanded.
- The dining specialist's restaurants are Ideas (suggestions) until one is scheduled. A suggestion offers
  Schedule on a day and Remove. Scheduling copies it into the itinerary as an activity with the same id, then
  applies the existing day action, so Undo restores the previous plan. Remove deletes it from both places.
  Restaurant ids are allocated in `identifyActivities`, the same way activity ids already are.
- Day plan and Getting around have no replacement. Their content is already the stops and legs.
- A plan with no flight, no stay or no guide renders no empty row or block.

## Failure modes

| Failure                                                                    | Where it would show                          | Guard                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A middle night of a multi-night stay has no row                            | Day 2 of a 4-night stay                      | Rows derived per night from `StaySelection.day` and `nights`; E2E counts rows per day    |
| Flight out appears on a trip with no return, or is missing when it has one | Last day                                     | Derived only from the arrival item's `returning` date, which must equal `brief.dates[1]` |
| A flight item is drawn twice, as a fixed row and as a flight row           | Day 1 or the last day                        | Transport items whose `selectionId` matches a flight selection are not also fixed rows   |
| A legacy hotel item with no stay selection is dropped                      | Plans saved before `stays` existed           | Hotel items with no matching selection keep the check-in-day fixed row                   |
| Alternative swap posts the wrong selection                                 | Taking a room or fare changes another hop    | The row passes its own section id and `selectionId` to `choose`                          |
| Tips fold state read throws in a private window                            | Tips block fails to render                   | Read and write wrapped in try/catch; default is expanded                                 |
| Tips fold state from one trip shows in another                             | Opening a second trip folded                 | The storage key includes `tripId`                                                        |
| Restaurant suggestion shows "Finding this place" forever                   | Ideas                                        | Suggestions skip the place lookup and show no location status                            |
| Scheduled restaurant appears again as a suggestion                         | Ideas after scheduling                       | Suggestions are the dining items whose id is not in the itinerary                        |
| Removed restaurant appears again as a suggestion                           | Ideas after Remove                           | Remove also deletes the dining item                                                      |
| Restaurant with no id (plan loaded before this change)                     | Schedule fails with "no longer in this trip" | `identifyActivities` allocates ids to `meal` items in the dining section on load         |
| Scheduled restaurant counted as admission in the unpriced note             | Budget summary                               | Suggestion-origin ids are left out of that count                                         |
| Undo after scheduling leaves the restaurant scheduled                      | Ideas and day                                | Undo restores the snapshot from before the action, as for every item action              |
| A plan with no guide, no stay or no flight shows an empty block            | Drawer                                       | Each block renders only when it has content                                              |

## Alternatives considered

- Hide the cards behind a toggle: rejected. The spec removes the card rendering, and a hidden card keeps a second
  place where a choice can be made.
- Keep the stay on its check-in day only, as the day view does today: rejected by the spec ("each day ends with
  the night's stay row").
- Write restaurants into the itinerary when the dining agent runs: rejected for this change. It changes the
  planner's output, and an itinerary item without a day would pass through the budget and conflict checks.
- Derive restaurant ids from the restaurant name: rejected. Two venues with one name would collide, and the code
  already refuses to derive identity from array position.
- Put the tips block above the budget summary: rejected. The spec places it at the top of the view, which is the
  day view.
- Store the tips fold state in the plan: rejected. It is a per-viewer preference, and plan data is shared.

## Risks

- The dining card's meal-budget envelope and the "Important notes" assumptions are no longer shown anywhere. The
  envelope stays in the section estimate and the total.
- A restaurant scheduled from Ideas is an activity with no price. It shows as "Price unknown", as an unpriced stop
  does today.
- The flight-out row relies on the round-trip return recorded on the arrival item. If a later change prices the
  return separately, the row must read the return's own candidate.

## Consequences

Checked by the E2E scripts (mock data mode):

- No specialist card and no section summary is rendered in the Trip drawer or on the phone Trip tab.
- A simulated trip shows the stay row at the end of each night and flight rows on the first and last day. Taking
  an Alternative stay or flight from those rows updates the cost and the estimated total.
- The tips block shows the destination guide, starts expanded, and stays folded for that trip after it is folded
  and the page reloads.
- Restaurants appear under Ideas; one can be scheduled on a day and the change can be undone.
- Plans with no flight, no stay or no guide render without empty rows or blocks.
- `docs/workspace-ui.md` and its Chinese pair describe the new view.

Also:

- The trip section components (`TripSection`, `ProposalDetails`) and their component tests are removed. Their checks
  move to the E2E scripts that drive the day view.
- `identifyActivities` also assigns ids to dining `meal` items. Plans are not otherwise changed.
- The shared contract (`packages/shared`) and the agents are unchanged.
