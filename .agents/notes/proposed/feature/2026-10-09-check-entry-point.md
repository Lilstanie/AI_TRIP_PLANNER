# Agent Note: one check entry point for plan edits, and undo that ignores Ideas

Status: proposed
Owner: spec #259, ticket #262

## Problem

A plan edit reaches the plan in two ways, and only one of them is checked.

- Time, place, leg, move (drag), choose, undo and the route check go through `POST /api/trip/preview-edit`
  (`previewEdit` in `apps/web/lib/trip/trip-edit.ts`). The server routes the day, collects the blockers, stores the
  notices and settles the budget.
- Remove, Move earlier or later (the arrows), Move to Ideas and Move to a day are applied in the browser by
  `applyItemAction` (`apps/web/lib/trip/item-actions.ts`). They clear a leg in the browser and rely on a later
  route check. No blocker, notice or undo step comes from the check.

The undo snapshot is built in the browser (`recordUndo` in `useTimelineEdits.ts`), and the notice mapping sits in the
server module. A reader has to know both to know what an edit does.

Three defects show in the drawer:

- A plan that changes while a timeline edit is being checked is not reported. `useTimelineEdits` aborts the request
  in an effect on every plan change, so the answer is `superseded` and nothing is shown. The "try again" message
  (`useTimelineEdits.ts`, fed by the `stale` result of `plan-revision.ts`) is therefore unreachable from the timeline.
  The chooser drops a stale answer with no message.
- A refused edit names a day, or nothing, for some blockers. "Route unavailable" and "confirm the place for every
  stop first" do not name the stop they are about, so the traveller cannot tell what to fix.
- A chat plan that replaces a timeline change clears the Undo step without a word. The change is lost silently.

## Proposal

**One entry point.** Every edit that changes a stop's day, time, place, order or leg goes through
`previewEdit` and through the client's `revisions.edit` (`plan-revision.ts`). The request gains four operations,
which the server applies with the same rules as its other edits:

- `remove` (the stop leaves the trip; a restaurant pick also leaves Dining);
- `idea` (the stop has no day or times; a restaurant pick is copied into the itinerary first);
- `schedule` (a stop or Idea goes to the end of a day, starting after the day's last stop, keeping its duration);
- `swap` (an arrow move: the stop trades start times with the stop before or after it, as `applyItemAction` does today).

Details, note and booked stay in the browser. They change no time, leg, route or budget.

**The check's rules, stated once.** These are the only rules. Each lives in `trip-edit.ts`:

1. A stop whose predecessor changes loses its stored leg (`arriveBy`), both the stop that now follows the moved
   stop's old place and the stop it now follows. The affected days are routed again in the same answer.
2. A refusal is a blocker that the edit cannot apply past: a stop running past midnight, and any blocker of `move`,
   `schedule` or `swap`. A `remove` or `idea` is never refused for a blocker; its notices are stored on the stop
   they are about, as a time edit's are. Refusals, and only refusals, name the stop they are about.
3. A refused edit leaves the plan unchanged. An accepted edit is applied at once.
4. The undo step is built by `undoStepOf(plan)` in `trip-edit.ts` from the plan the edit was checked against. It
   covers scheduled stops only (a day and both times), so an Idea never blocks Undo.
5. A check that is still in flight when the plan changes from elsewhere is not aborted. Its answer is judged against
   the revision it was sent for. If the plan has moved on, it is refused as stale and the traveller is told to try
   again. An answer superseded by a newer edit stays silent, as today.

**Chat replan.** A chat plan that replaces a plan the traveller changed on the timeline is shown with a notice:
"The new plan replaced your last change to the timeline." The notice is dismissed with the estimate notice's
button. Nothing is kept silently.

**Response shape.** Unchanged. The request's `operation` union gains the four kinds above; no response field is
added or removed. `packages/shared/src` is not touched.

**Wording.** A refused notice names its stop. The blockers that named only a day now also name the stop:

| Notice                                                                     | Before                                                                                       | After                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Beyond the day                                                             | "Day {day}: activity would extend beyond the day."                                           | "Day {day}: {stop} would extend beyond the day."                                                   |
| Confirm the place                                                          | "Day {day}: confirm the place for every stop first, so travel times between them can be checked." | "Day {day}: confirm the place for {stop} first, so its travel time can be checked."           |
| Route unavailable, when refused                                            | "Route unavailable" (or the provider's own sentence)                                         | "{stop}: {reason}" with the reason as before                                                       |
| Stale edit                                                                 | "The plan changed while this change was being checked. Try the change again."                | unchanged, now shown                                                                               |
| Chat replan after a timeline change (new)                                  | none                                                                                         | "The new plan replaced your last change to the timeline."                                          |

The accepted route notice on a stop keeps its wording ("Route unavailable").

## Failure modes

Each row is a case in an E2E script (listed in the Consequences section once the change lands) or is named as not
changed.

| #   | Situation                                                                             | Behaviour                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A time change on a trip with an Idea, then Undo                                       | The time change is applied; Undo restores the earlier time with no error. The Idea is neither in the step nor a blocker.                                              |
| 2   | Undo after a move to Ideas (an item undo)                                             | The item undo restores the plan as it was before the action, as today.                                                                                                 |
| 3   | Move refused: a stop's route is unavailable                                           | Plan unchanged; the alert names the stop: "{stop}: {reason}".                                                                                                          |
| 4   | Move refused: the neighbour has no saved place                                        | Plan unchanged; the alert names the stop to confirm.                                                                                                                   |
| 5   | Time change pushes a later stop past midnight                                         | Plan unchanged; the alert names that stop.                                                                                                                             |
| 6   | Time change makes a leg's travel buffer unmet                                         | Applied; the notice is stored on the destination stop only (as today; `notice-keys`).                                                                                  |
| 7   | Remove a stop; the stop after it had a time from it                                   | Applied; the next stop's leg is re-routed from its new neighbour, and no time from the removed stop remains.                                                           |
| 8   | Remove a stop whose next stop has no saved place                                      | Applied; the next stop shows no time until both places are saved; the notice names the pair's stop.                                                                   |
| 9   | Move a stop later (arrow) past its neighbour                                          | Applied; the moved stop's old follower loses the leg from the moved stop; the new follower shows the route from its new neighbour once routed, or no time.            |
| 10  | Move to Ideas                                                                         | Applied; the stop has no day or times; the stop that followed it loses its leg; its item undo restores the plan.                                                       |
| 11  | Schedule an Idea on a day with no room                                                | Refused: the alert names the stop ("{stop}: ...beyond the day").                                                                                                       |
| 12  | Swap with a neighbour that would overlap the next stop                                | Refused as today, with the same sentence (a `NoticeError`, not a blocker).                                                                                             |
| 13  | A restaurant pick acted on from Dining (remove, Ideas, schedule)                      | The server copies it into the itinerary first, then applies the action; removal also drops the pick from Dining, as today.                                            |
| 14  | Timeline edit answered after the plan changed from chat, a restore or another trip    | Dropped; plan unchanged; "The plan changed while this change was being checked. Try the change again." is shown. (Fixed: today it is silent.)                          |
| 15  | The chooser's swap answered after the plan changed                                    | Dropped; the same message is shown in the chooser. (Fixed: today it is silent.)                                                                                        |
| 16  | Two edits in quick succession                                                         | The earlier request is aborted and its answer ignored, silently, as today.                                                                                             |
| 17  | A background job (save or verify) is in flight when an edit starts                    | The job is discarded; the edit is checked alone (plan-revision rules, unchanged).                                                                                      |
| 18  | A chat plan replaces a plan the traveller changed on the timeline                     | The new plan is shown; the Undo step is cleared; a notice says the change was replaced. (New.)                                                                          |
| 19  | A chat plan replaces an unchanged plan                                                | No replaced notice; the estimate notice is as today.                                                                                                                   |
| 20  | A request fails (network, server error)                                               | "Something went wrong" or "Preview failed" as today; the plan is unchanged.                                                                                            |
| 21  | An edit whose base version is no longer the plan's                                    | "This edit is stale. Start from the current plan." as today; the plan is unchanged.                                                                                    |
| 22  | Simulated (mock) data mode                                                            | The same rules and requests; fixture legs; no provider request.                                                                                                        |
| 23  | Chinese interface                                                                     | Every notice above is localised; new and changed keys have Chinese strings in the same change.                                                                         |

## Alternatives considered

- **Keep the browser for remove, move and Ideas, and add a second check there.** Rejected. Two checks drift, which is
  how the leg rule came to differ between the browser and the server. The ticket asks for one entry point.
- **Put the undo snapshot in the response (`undo` field).** Rejected for now. The browser holds the plan the edit was
  sent with, and `undoStepOf` in `trip-edit.ts` builds it from that plan, so no response field is needed. The response
  shape does not change.
- **Refuse removals with blockers, as moves are.** Rejected. A removal that the next stop's route cannot satisfy would
  be impossible to make; the notice on the stop says what to fix, as a time change's does.
- **Abort the check when the plan changes, and say nothing.** Rejected; it is the defect in row 14.
- **Keep the chat plan and merge the timeline change into it.** Rejected. The chat's plan is the planner's answer to a
  new request; merging the change would invent a schedule the chat did not make. Saying that it was replaced is
  honest and leaves the choice with the traveller.

## Acceptance criteria

1. A time change on a trip with an Idea, followed by Undo, restores the time with no error.
2. A notice from an accepted or refused edit appears under its own stop only.
3. A refused edit names the stop it is about.
4. A refused edit because the plan changed during its check says to try again, and the change did not apply.
5. Moving a stop clears the travel time of the stop after it when that time came from the old neighbour.
6. A chat replan keeps the applied change or says that it replaced it.
7. Removing, moving and moving to Ideas go through the same check.
8. Wording for cases that already work does not change, except the fixes above.
9. No unit tests; no `packages/shared/src` change; the response shape is unchanged.

## Risks

- Remove, move and Ideas now wait for the server. A slow route check delays an arrow move that used to be instant.
  Each edit is one request, as a time change already is; the pending state is shown while it runs.
- A day's legs are routed on every removal from it, one request per leg. The cost is the same as a move's today.
- Restoring an item undo restores a plan object with an older `editVersion`; the next edit sends that version, which
  the server accepts because the version travels with the plan.
- Wording changes in the table above reach the Chinese interface; each changed key needs its Chinese string.
