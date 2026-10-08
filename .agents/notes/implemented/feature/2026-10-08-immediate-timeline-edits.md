# Agent Note: Timeline edits apply immediately with Undo

Status: implemented
Owner: spec #233, ticket #235

## Problem

Every stop edit in the Trip timeline (time, move, day, place) waited in a "Review this change" panel until
the traveller pressed "Apply changes". The traveller was asked to confirm changes that were not decisions.
Spec #233 removes confirmations; the preview panel was the last one.

## Decision

An edit is still checked by the server through `POST /api/trip/preview-edit`, because the server recomputes
routes, budget and conflicts. The client applies an accepted plan at once. A refused edit leaves the plan
unchanged and lists its blockers as an alert in the timeline. "Undo last change" replays the previous
activities through the same path. `EditPreviewPanel` is removed.

Failure modes, decided before the code:

| #   | Situation                                                                          | Behaviour                                                                                                                          |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The plan changed (chat replan, restore) while the check was in flight              | The result is discarded; the plan is unchanged and nothing applies.                                                                |
| 2   | The server refuses the edit (blocker: stop past the end of the day, unknown route) | The plan is unchanged; a keyed Notice lists the blockers. The edit is refused, not stored as a conflict.                           |
| 3   | The check request fails (network, 5xx, provider outage)                            | The plan is unchanged; a keyed Notice "Preview failed. Try the change again." is shown.                                            |
| 4   | Two edits in quick succession                                                      | The earlier request is aborted; a response for a stale base is ignored.                                                            |
| 5   | The server accepts an edit that creates a conflict (for example over budget)       | Applied; the conflict is stored on the plan and shown in the timeline status. Not refused.                                         |
| 6   | A plan arrives from chat                                                           | The undo step is cleared; nothing is left to undo.                                                                                 |
| 7   | Undo itself                                                                        | Undo is an edit: it goes through the same check and apply path and replaces the undo step with the reverse step, so Undo can redo. |

Blockers from failure mode 2 are refused, not stored as conflicts. A stop past the end of the day and an unknown
route both refuse the edit.

## Alternatives considered

- Keep the preview panel and dismiss it automatically: rejected. It still shows a review step, and the spec
  removes review steps.
- Apply without asking the server: rejected. The server recomputes routes and budget; the client cannot.
- Store blockers as conflicts on the plan: rejected for this change. A conflict names an agent, not a stop
  (`RevisionRequest` in `packages/shared`), so marking a stop needs a separate shared-contract change.

## Consequences

- The Trip drawer no longer offers a review step for stop edits. "Change time" (formerly "Preview time change")
  is the only time control.
- A conflict introduced by an edit is shown in the timeline status, not on the stop, until a follow-up adds
  stop-level markers.
- Routes checked by a route check still reach the map and the connection rows; the fare and route text that the
  preview panel showed is no longer shown in a panel.
- Partly superseded by the [leg travel times](2026-10-08-leg-travel-times.md) note:
  the route check button this note mentions is removed, each leg is routed automatically, and a Google answer with
  no route reads "No route found" and adds no time. Only a provider failure refuses an edit (failure mode 2 above).
- `apps/web/tests/e2e/timeline.e2e.mjs`, `itinerary.e2e.mjs` and `workspace-chinese.e2e.mjs` check the immediate
  apply, the refused-edit alert and Undo.

## Supersession

Partly superseded by [Remove status labels and Review plan](../../proposed/feature/2026-10-08-remove-status-labels.md)
(#240). The "Review plan" button and its dialog, the "Needs review" and "Draft" labels in the Trip drawer, the
phone shell and the trip list are removed. The "conflict shown in the timeline status, not on the stop" statement
above no longer holds: an unresolved conflict is shown on the stop, leg or day it targets, or under the budget bar.
