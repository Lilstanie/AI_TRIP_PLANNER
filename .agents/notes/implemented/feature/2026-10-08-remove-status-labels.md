# Agent Note: Remove status labels and Review plan; show conflicts where they apply

Status: implemented
Owner: spec #233, ticket #240

## Problem

The Trip drawer, the trip list and the phone Trip tab carry labels the traveller cannot act on. The Trip
drawer header says "Needs review" or "Draft", the trip list gives each trip the same label, and "Review plan"
opens a dialog that lists the conflicts and the change from the previous estimate. Nothing in that dialog can
be confirmed or changed; the conflicts are only listed, away from the stop, leg or day they concern. Spec #233
removes confirmations and review steps. The label and the dialog are the last of them.

The trip list's label is data without a visible surface: the catalog stores it and the sidebar prop carries it,
but nothing renders it. Removing the label removes the field as well.

After a replan from chat, the traveller sees the new estimate and has no reading of how far it moved. The
dialog gave that figure only to someone who opened it.

## Decision

- Remove the "Needs review" / "Draft" label from the Trip drawer and the phone Trip tab, the trip list's
  status field, the "Review plan" button and the review dialog. `TripStatus`, `statusForPlan`, `tripStatus`,
  `TripRecord.status` and `HistoryItem.status` go with them. Stored catalogs still load: an unknown `status` key is ignored.
- Show each unresolved conflict where it applies, derived from the plan on the workspace (no change to
  `packages/shared`):
  - a conflict whose reason is an overrun or an infeasible budget is shown under the budget bar, as a sentence;
  - a time overlap (`time overlap on day N`) is shown on each stop of day N whose time window overlaps another
    scheduled item on that day; when no stop of the day is involved (a flight or a stay overlaps another), it is
    shown under the day's title;
  - a route or leg issue in `plan.editIssues` is shown on the stop whose id it names; an issue naming only stops
    that no longer exist is not shown;
  - any other conflict that names a day is shown under that day's title; a conflict that names no stop or day is
    shown under the budget bar.
- After a replan from chat (the `planned` event) that had a previous estimate, a one-off Notice in the workspace
  notices area says the signed change from the previous estimate, "Estimate changed by +AUD 120.00 from the
  previous plan.", or "Estimate unchanged from the previous plan." when the change rounds to zero. It has a
  Dismiss button. It is not persisted, and a timeline edit, a reopened chat or a reload clears it.
- Every new string has a Chinese entry in `apps/web/lib/i18n/workspace-messages.ts`; keys with no remaining use
  (`Review plan`, `Needs review`, `Needs you`, `Draft`, `No plan yet`, `No plan yet. Update your trip
preferences to start.`, `No detected schedule conflicts.`, `Change from the previous estimate: {v0}.`,
  `No previous plan to compare.`) are removed. `Conflicts` stays: the activity check in `agent-lab` uses it.

## Failure modes

| #   | Situation                                                        | Behaviour                                                                                                                                                |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | An edit brings the estimate back under budget                    | `settle()` recomputes `plan.conflicts`; the budget sentence is gone. Nothing stale is shown.                                                             |
| 2   | An overlap between a stop and a flight or stay on the same day   | The stop is marked when it is itself scheduled and overlaps; otherwise the sentence is under the day title. No stop is marked for a flight.              |
| 3   | An overlap conflict whose pair is no longer on the plan          | Shown under the day title, because the plan still names the day. The conflict is recomputed on every edit, so this is rare.                              |
| 4   | A stop with both an overlap and a route issue                    | Both are shown on the stop, overlap first.                                                                                                               |
| 5   | A route issue whose stops were removed                           | Not shown anywhere. Its stops no longer exist.                                                                                                           |
| 6   | A conflict from a specialist with no day and no stop             | Shown as the plan's own text under the budget bar. It is not translated; the notice is `raw`.                                                            |
| 7   | Chat replan with an unchanged estimate                           | The "unchanged" notice shows, not a "+0" figure.                                                                                                         |
| 8   | First plan in a chat (no previous estimate)                      | No notice.                                                                                                                                               |
| 9   | A second chat replan while the first notice is shown             | The notice shows the new change; the earlier one is replaced.                                                                                            |
| 10  | A timeline edit or a move after the replan                       | The notice is cleared. Its figure would describe a plan that has changed again.                                                                          |
| 11  | Reload, or a chat opened from history                            | No notice. It is one-off and not stored.                                                                                                                 |
| 12  | A catalog saved before this change, with a `status` on each trip | Loads; the field is ignored and never shown.                                                                                                             |
| 13  | Chinese interface                                                | Every authored string is translated. Raw text from the plan (a specialist's conflict, a route message) stays as received, as the Notice contract allows. |
| 14  | Phone width                                                      | The notice wraps inside the notices area; the Dismiss button is a full-size button.                                                                      |

## Alternatives considered

- Add a stop id to `RevisionRequest` in `packages/shared` and map each conflict to its stop: rejected for this
  ticket. The spec forbids changing `packages/shared`, and the overlap can be found from the plan's own times.
- Parse the times out of the overlap reason text to find the pair: rejected. The day is read from the reason; the
  stops are found from the plan's times, the same rule the orchestrator uses to find the overlap.
- Keep the review dialog and rename it "Conflicts": rejected. The spec asks for the conflicts to appear where they
  apply, not in one list the traveller has to open.
- Show the replan change in the chat transcript as a message: rejected. A message would be stored with the chat
  and would need a new message role in the catalog schema; the notice is one-off.
- Show the replan change only inside the Trip drawer: rejected. A replan is made in chat, and on the phone the Trip
  tab is not open when it finishes. The notices area sits above every view.
- Keep a hidden `status` in the catalog for future use: rejected. Nothing reads it, and the derived value would
  drift from the plan.

## Consequences

Checked by the E2E scripts (mock data mode):

- No "Needs review", "Draft", "Needs you" or "Review plan" text is rendered in the Trip drawer, the trip list or
  the phone shell, at either width and in either language.
- A simulated plan with an over-budget conflict shows the sentence under the budget bar.
- An overlap shows on the affected stop; a flight overlap shows under the day title.
- After a chat replan, a Notice shows the signed change in the estimate once, and Dismiss removes it.
- Every new string has a Chinese entry.
- `apps/web/tests/e2e/timeline.e2e.mjs`, `itinerary.e2e.mjs`, `auto-save-places.e2e.mjs` and `workspace-chinese.e2e.mjs`
  pass in the mock data mode, and the new checks are in those scripts.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md` describe the new surfaces; the #235 and #238 notes carry a
  Supersession line.

## Risks

- Overlap detection repeats the orchestrator's rule on the web side. A change to one must change the other; the
  E2E overlap check covers the current rule only.
- Text from the plan that is not authored by the workspace (specialist conflicts, route messages) is shown in its
  stored language. A Chinese traveller may see English there.
- The budget sentence repeats what the budget bar already says in part. It is kept because the spec asks for the
  conflict itself to be shown there.
- The replan notice is one-off by design. A traveller who does not see it has no other record of the change.
