# Agent Note: one owner for plan revisions and background work

Status: proposed
Owner: spec #259, ticket #260

## Problem

Two background hooks (`useLegRoutes`, `useAutoSavePlaces`), the timeline's edit hook (`useTimelineEdits`) and the
chooser (`useChooseCandidate`, a traveller's swap of a flight or stay) each keep their own abort, version check and
retry. Their rules are written in comments in
four places, and they disagree in three ways:

- A route check and an automatic place save can run at the same time for one trip, so two background requests are
  in flight and a save can land while a day is being checked.
- A day is recorded as routed when it is first seen with all its places saved and every leg stored
  (`dayNeedingLegs`), before any check has run for it. A day whose stops already carry travel times and whose places
  were saved while the route loop was busy with another day is never checked.
- The loop returns at the first day that needs routing, so a later day that is unsaved is not observed as unsaved.
  Its places can then be saved without it ever being marked as waiting.

The workspace (`WorkspaceView.tsx`) gates each background hook with `enabled: !(busy || editPending)`, so the rule
"a traveller's edit wins" lives in the caller, not in the work it gates.

## Proposal

One module owns the plan revision and the background work for a trip. It lives in
`apps/web/components/trip/plan-revision.ts` and exports a hook, `usePlanRevision`, that the workspace creates once.

**Rules the module states, and the only place they live:**

1. A plan revision is the plan object a request was sent for. A result applies only when its revision is still the
   current plan.
2. A traveller's edit (`edit`) wins. Starting an edit aborts the background job in flight at once, in the same tick,
   before React renders; the job's result is discarded. Background work does not start while an edit, a place search
   or a chat turn is in flight.
3. At most one background job is in flight per trip. A job is a request for one revision: a place save, or one day's
   `verify`. When two are wanted, the first offered runs and the other waits for it to finish.
4. A job that is discarded (aborted, or its revision is no longer current) is offered again for the current revision
   when it is still needed. A job that is refused or fails is not offered again until its own inputs change, as today.
5. A day is recorded as routed only when its `verify` succeeds, or when an applied edit has already routed it (the
   server's answer to that edit is the check). The first-sight shortcut is removed. A day is routed only once every
   stop on it has a saved place.

**The two background hooks, the edit hook and the chooser become thin callers.** The chooser's swap is a traveller's
edit, so it goes through `edit` like a timeline edit. `useAutoSavePlaces` offers the next unsaved
stop as a save job. `useLegRoutes` offers the first day that needs routing as a verify job. Their notices and their
memory (which stops are tried, which days are routed or refused) stay with them, because they are their own
bookkeeping. `useTimelineEdits` sends its operations through `edit`. `WorkspaceView.tsx` no longer passes an `enabled`
flag to any background hook; it passes the facts (a chat turn is running, an edit is pending) to the module.

**Failure modes, written before the code.** Each row is a test case in `plan-revision.e2e.mjs` or is covered by an
existing E2E named in the table.

| #   | Situation                                                                                             | Behaviour                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A route check is held open and the traveller makes a time edit                                        | The check is aborted at once and its answer is discarded. The edit is applied. The day is checked again for the edited plan if its stops changed. The held answer never replaces the edited plan.               |
| 2   | The held route check is released after the edit has been applied                                      | Ignored: its base is no longer the plan. No notice, no change.                                                                                                                                                  |
| 3   | An auto-save is held open and the traveller makes an edit                                             | The save is aborted at once. The edit is applied. The stop is sent again for the edited plan if its place is still unsaved, once the edit has settled.                                                         |
| 4   | A held auto-save is released after the edit has been applied                                          | Ignored. The stop is not marked failed.                                                                                                                                                                         |
| 5   | An edit is refused (blockers)                                                                         | The plan is unchanged; the background work resumes for the same revision; the blockers show as today.                                                                                                          |
| 6   | An edit fails with a network or server error                                                          | "Something went wrong" or "Preview failed" as today; background work resumes for the same revision.                                                                                                             |
| 7   | Two edits in quick succession                                                                         | The earlier request is aborted and its answer ignored (as today). Background work waits until the last edit settles.                                                                                           |
| 8   | A chat plan arrives while an edit is in flight                                                        | The edit's answer is dropped with "The plan changed while this change was being checked", as today. Nothing background applies.                                                                                |
| 9   | A chat turn starts while a route check or save is in flight                                           | The background job is aborted and discarded; background work waits for the turn to end, as today.                                                                                                              |
| 10  | A place search is running in the timeline                                                             | Background work waits for the search, as today. The search does not change the plan.                                                                                                                            |
| 11  | A save is in flight and a route check becomes wanted                                                  | The check waits. The save finishes (or is discarded) first. The check then runs for the plan the save produced.                                                                                                 |
| 12  | A route check is in flight and a save becomes wanted                                                  | The save waits for the check. The check's answer applies (if its revision is still current) and the save then runs for the new revision.                                                                       |
| 13  | Five stops of a day are saved one by one                                                              | Five saves, no routing; one `verify` for the day after the last save (`auto-save-places.e2e.mjs`, scenario 4).                                                                                                  |
| 14  | A day whose stops carry travel times is seen while another day is being checked                      | Its places are saved; it is then checked once, after its last save. It is never marked routed before its check (new E2E scenario 3).                                                                           |
| 15  | A day whose stops carry travel times and whose places are all saved when the page loads              | Checked once on load. **Behaviour change**: the first-sight shortcut is removed, so each day with two or more stops costs one `verify` per page load. Recorded as a consequence below.                          |
| 16  | A day with a stop that has no saved place                                                             | Not checked. Checked once when its last place is saved.                                                                                                                                                         |
| 17  | A day's verify is refused or fails                                                                    | A problem is shown for that day; the day is not asked again until its stops change (as today).                                                                                                                  |
| 18  | A day's verify is aborted by an edit or a chat turn                                                   | Not recorded as routed. It is asked again for the current plan.                                                                                                                                                 |
| 19  | An applied edit re-times a day                                                                        | The server routed every leg of the day in its answer; the day is recorded as routed, and no second verify runs (`timeline.e2e.mjs`).                                                                          |
| 20  | Undo after an edit                                                                                    | The restored plan is a new revision. Background work runs for it when still needed.                                                                                                                             |
| 21  | The trip is left or unmounted while a job is in flight                                                | The job is aborted; its result is discarded.                                                                                                                                                                    |
| 22  | Simulated (mock) data mode                                                                            | The same rules and requests as live mode; fixture legs. No provider request.                                                                                                                                    |

## Alternatives considered

**Keep the three hooks and add a shared lock.** Rejected. A lock stops two jobs at once but leaves each hook deciding
when its result applies, which is the rule that drifted. The ticket asks for one place that says when a result applies.

**One reducer for every job and notice.** Rejected for this ticket. Notices and the per-stop or per-day memories are
specific to each job; a reducer would move them without removing a rule. Candidate 2 (one notice path) is separate.

**Keep the first-sight shortcut and only observe every day on each pass.** Rejected. It would keep a day recorded as
routed without a request, which the ticket rules out. Observing every day fixes the missed-save case only for passes
the loop runs, and an edit or save in flight already skips passes.

**Make the server route the stored legs on load.** Rejected. It moves the cost to every load of every trip, and the
legs are still only checked by a request.

## Acceptance criteria

- An edit made while a route check is held open is applied after the check returns; the check's answer does not replace
  the edited plan (`plan-revision.e2e.mjs`, scenario 1).
- An edit made while an auto-save is held open is applied; the save runs again for the new plan if its place is still
  unsaved (`plan-revision.e2e.mjs`, scenario 2).
- A day whose stops already carry travel times is checked once its places are saved (`plan-revision.e2e.mjs`,
  scenario 3).
- At most one background request is in flight per trip, counted by the E2E stub (`plan-revision.e2e.mjs`).
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places workspace-chinese` exits 0.
- No unit tests are added; no change to `packages/shared/src`.

## Risks

- **Quota on load.** Removing the first-sight shortcut means each day with two or more scheduled stops is checked once
  per page load. In live mode each check is one Routes request per leg (walk, and transit for long walks). Trips with
  many days cost more on each load. The alternative is a server-side record of "routed" per day, which is a shared
  contract change and is not part of this ticket.
- **Aborted requests still reach the server.** A route check aborted by an edit may still be answered by the server
  and billed. The client ignores the answer.
- **Edit answer ordering.** An edit is applied only if the plan it was sent for is still current. A chat plan arriving
  first drops the edit with a message, as today; the traveller retries.
