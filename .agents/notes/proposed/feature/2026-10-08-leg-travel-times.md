# Agent Note: each leg shows its travel time, and the traveller picks its mode

Status: proposed
Owner: spec #233, ticket #237

## Problem

The Trip timeline shows the journey between two stops only after the traveller presses "Check routes for
Day N", and that button sends one travel mode for the whole day (Walk or Public transport). A leg between two
saved places therefore has no time and no mode until someone asks for it, and a traveller who would rather drive
one leg and walk another cannot say so. Spec #233 removes the buttons that stand between the traveller and the
answer; this one is the last of them.

The planner's own legs (`ProposalItem.arriveBy`, see [connections](../../implemented/architecture/2026-09-22-arrive-by-connections.md))
are estimates from the planning run. They go stale as soon as a stop moves, and nothing re-checks them.

## Proposal

**A leg is the journey into a stop from the stop before it on the same day.** Its mode and time live on the
destination stop in the existing `arriveBy` field (`mode`, `durationMin`, `from`). No field is added to
`packages/shared/src`. The server writes `arriveBy` from the route it verified, so a leg's mode and duration are
part of the plan and survive a reload of the plan, a later re-timing and an undo.

**Modes.** A leg has one of three modes the traveller can choose: `walk`, `transit` (shown as Public transport)
and `drive`. The stored value is the lower-case mode name; a Google route's `WALK`, `TRANSIT` and `DRIVE` map to
it. A planner estimate with another mode (`bus`, `train`, ...) is shown as its estimate until the leg is routed.

**Default mode.** A leg the traveller has not chosen is routed on foot first. If the walk is 20 minutes or less
(inclusive), the leg is walking. If the walk is longer, the leg is routed by public transport, and the public
transport route is kept when Google finds one; when it does not, the walk is kept, however long. The threshold
and the default are in `lib/trip/leg-routes.ts` (`WALK_LIMIT_MIN`, `defaultLegRoute`).

**When legs are routed.**

- A day's places are saved. Auto-saved places are sent with `routeLater`, so each save applies without routing, and
  when every stop of the day has a saved place the workspace requests one `verify` for that day. The day's legs
  are routed once.
- An applied edit that changes the day (time, move, a manual place change, undo) routes that day's legs again, as
  today. Each leg is routed with its stored mode, or the default when it has none.
- The traveller changes one leg's mode. Only that leg is requested; the other legs of the day keep their stored
  durations, and the rest of the day is re-timed as edits already do.
- No other render or change routes anything. A day whose legs all carry an `arriveBy` is not requested again on
  reload or when nothing on that day changed.

**Unroutable and failed legs.** Google answering without a route is a `no_route` leg: it shows "No route found"
on that leg, its `arriveBy` is removed, it does not refuse the edit and it adds no time. A provider failure (HTTP
429, 5xx, a network error, a missing key) is an `unavailable` leg: the edit is refused with its keyed notice, as
today, and the plan does not change.

**Simulated mode.** When the request says data mode `mock`, the server does not call Google. It uses a fixture
route whose durations are a fixed function of the two places and the mode, a fixture place and the UTC time zone.
A fixture leg is shown as an estimate, never as checked.

**Removed.** The "Check routes for Day N" button, its hint, and the day-wide Walk / Public transport switch. The
`mode` field of `preview-edit` is removed; the server takes each leg's mode.

## Failure modes

Written before the code. Each row is a test case for the E2E in `timeline.e2e.mjs`, or is covered by the review
checklist where the E2E cannot reach it.

| #   | Situation                                                              | Behaviour                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A walk of 20 minutes or less                                           | Walk. No transit request.                                                                                                                                                                           |
| 2   | A walk of more than 20 minutes and a transit route                     | Transit, with its duration and fare.                                                                                                                                                                |
| 3   | A walk of more than 20 minutes and no transit route                    | Walk, labelled with its long duration. The walk is not replaced by "No route found".                                                                                                                |
| 4   | Walk and transit both answer no route                                  | `no_route`: "No route found" on the leg, `arriveBy` removed, edit applied, no time added.                                                                                                           |
| 5   | The traveller chooses Public transport for a leg with no transit route | `no_route` on that leg. Not silently replaced by walking; the chosen mode is what was asked for.                                                                                                    |
| 6   | Google answers with a 5xx, a 429 or a network error                    | `unavailable`: the edit is refused with the keyed notice ("Google request failed …"), the plan is unchanged. A background day pass shows the same notice and does not retry until the plan changes. |
| 7   | Google answers 200 with no route in the body                           | `no_route`, not an outage. Only HTTP errors and exceptions are outages.                                                                                                                             |
| 8   | The traveller changes a leg's mode                                     | One route request for that leg. The other legs of the day keep their stored durations. The rest of the day is re-timed from the changed leg. Applied at once; "Undo last change" is offered.        |
| 9   | Another edit re-times the day after a mode change                      | The stored mode is requested again for each leg. A chosen mode survives re-timing.                                                                                                                  |
| 10  | A stop is moved, swapped or moved to another day in the browser        | Its `arriveBy` and that of the stop whose predecessor changed are removed, as today. The new leg uses the default mode until chosen; the day pass routes it.                                        |
| 11  | Undo after a mode change                                               | The snapshot restores the stop's `arriveBy`, including its previous mode. Undo routes the day with the restored modes. A snapshot without `arriveBy` removes it.                                    |
| 12  | Auto-saves of five places on one day                                   | Five saves, no routing; one `verify` for the day once all five are saved.                                                                                                                           |
| 13  | A day with a stop the map cannot find                                  | No pass for that day. Its pairs show the planner's estimate; no alert appears.                                                                                                                      |
| 14  | A chat replan arrives while a pass is in flight                        | The pass result is discarded (its base is no longer the plan). The new plan gets its own pass when its places are saved.                                                                            |
| 15  | A leg whose stops are not both confirmed                               | No mode control, no route. A mode change on it is refused by the existing "confirm the place" blocker.                                                                                              |
| 16  | Mode choice from keyboard or a screen reader                           | A native select labelled "Travel from {from} to {to}", 44 px tall at phone width. Its value is the leg's current mode; a change is announced by the applied-edit status.                            |
| 17  | Simulated mode                                                         | Fixture legs, shown as estimates. No provider request is made, and the day pass works as in live mode.                                                                                              |
| 18  | Simulated mode without a Maps key                                      | Stops cannot be confirmed without the Places routes, so there are no routed legs; the planner's estimates show. This is the one place simulated mode still depends on a key. See Risks.             |
| 19  | Reload of a plan whose legs were routed earlier                        | The stored `arriveBy` shows as an estimate until the leg is routed again. The "No route found" of a `no_route` leg is not kept, and the leg shows its mode control only.                            |

## Alternatives considered

**A new shared field for the traveller's chosen mode.** Rejected for this ticket. `arriveBy` already names the
mode and duration of a leg, and a leg has one mode. A separate field would have to be kept in step with it. The
ticket allows a new field only if `arriveBy` cannot carry the choice, and it can.

**Keep one mode for the whole day and add a mode per leg later.** Rejected. The spec asks for a mode per leg, and
a day-wide default cannot express "drive this one".

**Route every leg whenever the timeline renders.** Rejected: the route quota is per request, and a render is not a
change. Legs are routed on the events listed under Proposal.

**Send all of a day's saves in one request.** Rejected: the preview endpoint takes one operation, and a batch would
need a new server contract in `packages/shared`.

**Store each leg's endpoints (place ids) to reuse legs across any edit.** Rejected for now. It needs a new field or
a parse of `arriveBy.from`. Re-requesting the legs an edit touches costs little, because a day has few stops.

**Treat "No route found" as an outage and refuse the edit.** Rejected. The ticket asks for the leg to show it. A
refused time edit because one pair has no transit is the behaviour the ticket removes.

**Fall back to the planner's estimate when a route fails.** Rejected. It would show a time Google did not verify,
labelled as the mode the traveller chose.

## Acceptance criteria

- After a simulated trip's stops have saved places, each pair of consecutive stops shows its mode and duration without
  a button.
- Changing one leg's mode routes only that leg, re-times the later stops, applies at once and can be undone.
- A chosen mode is kept when a later edit re-times the day.
- A day's legs are not requested again when nothing on that day changed.
- An unroutable leg shows "No route found"; a provider failure shows its keyed notice.
- The default mode and the walk threshold are written here and in code, with the failure modes above.
- Every leg control is keyboard reachable, announced, and at least 44 px tall on phones.
- The route-check E2E is updated and runs; `GLOSSARY.md` gains **Leg**; `docs/workspace-ui.md` and its Chinese
  pair describe the behaviour.

## Risks

- **Quota.** The day pass and each day-changing edit request every routable leg of that day, and a long walk costs
  two requests (walk, then transit). A trip with many stops on one day uses more Routes requests than a single
  route check did. The walk threshold limits the second request to long walks.
- **Simulated mode needs a key for places.** Fixture legs need confirmed stops, and confirming a stop needs the
  Places routes. Without a key nothing is confirmed, so simulated mode shows only planner estimates unless a test
  stubs Places. Fixture places for simulated mode are a possible follow-up; they are not part of this change.
- **Estimates after reload.** The stored `arriveBy` is the only memory of a verified leg, so a reload shows verified
  legs as estimates, and drops the "No route found" of a `no_route` leg.
- **Shared contract use.** `arriveBy.mode` is now written as `walk`, `transit` or `drive` by the workspace. The
  shared type already allows these values, so no contract changes; readers of the planner's estimates must accept
  both.

## Supersession

When this note is promoted, it partly supersedes two implemented notes, and their facts are updated in the same
change:

- [Timeline edits apply immediately](../../implemented/feature/2026-10-08-immediate-timeline-edits.md): an unknown
  route no longer refuses an edit (failure mode 2); only a provider failure does. Its "route check" wording describes
  the button this note removes.
- [Map-found places are saved automatically](../../implemented/feature/2026-10-08-auto-save-stop-places.md): auto-saved
  places are sent with `routeLater`, and their day is routed once after the last save, not with walking routes on
  each save.
