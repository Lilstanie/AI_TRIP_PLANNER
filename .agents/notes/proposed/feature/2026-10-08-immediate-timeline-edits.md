# Agent Note: Timeline edits apply immediately with Undo

Status: proposed
Owner: spec #233, ticket #235

## Problem

Every stop edit in the Trip timeline (time, move, day, place) is previewed by `/api/trip/preview-edit`
and waits in an "Review this change" panel until the traveller presses "Apply changes". The traveller is
asked to confirm changes that are not decisions. Spec #233 removes confirmations; the preview panel is
the last one.

## Proposal

An edit still goes through the server preview, because the server recomputes routes, budget and
conflicts. The difference is that the client applies the previewed plan at once when the server accepts
it. "Undo last change" restores the previous plan through the same preview path. The preview panel
component is removed.

Failure modes, written before the code:

| #   | Situation                                                                          | Behaviour                                                                                                              |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | The plan changed (chat replan, restore) while the preview was in flight            | Preview is discarded; plan unchanged; no apply. Existing behaviour kept.                                               |
| 2   | The server refuses the edit (blocker: stop past the end of the day, unknown route) | Plan unchanged; a keyed Notice lists the blockers. The edit is refused, not stored as a conflict.                      |
| 3   | The preview request fails (network, 5xx, provider outage)                          | Plan unchanged; a keyed Notice "Preview failed. Try the change again."                                                 |
| 4   | Two edits in quick succession                                                      | The earlier request is aborted; only the latest preview may apply. A response for a stale base is ignored.             |
| 5   | The server accepts but the edit creates a conflict (for example over budget)       | Applied; the conflict is stored on the plan and shown in the timeline status. Not refused.                             |
| 6   | Undo after a chat replan                                                           | Undo is cleared when a plan arrives from chat; nothing to undo.                                                        |
| 7   | Undo itself                                                                        | Undo is an edit: it goes through the same preview and apply path, and replaces the undo step with the edit it reverts. |

Blockers from failure mode 2 are refused, not stored as conflicts. This is the per-blocker decision the
spec asks for: a stop past the end of the day and an unknown route both refuse the edit.

## Alternatives considered

- Keep the preview panel but auto-dismiss it: rejected. It still shows a review step, and the
  spec removes review steps.
- Apply without asking the server: rejected. The server recomputes routes and budget; the client cannot.
- Store blockers as conflicts on the plan: rejected for this ticket. A conflict is shown on a stop only
  when it names one; the current `RevisionRequest` conflicts name agents, not stops, so stop-level
  marking needs a separate change to `packages/shared`.

## Acceptance criteria

- Time, move, day and place edits apply without a preview step; `EditPreviewPanel` is removed.
- Undo restores the previous plan and is cleared when a new plan arrives from chat.
- A refused edit leaves the plan unchanged and shows a keyed Notice.
- E2E scripts that pressed "Apply changes" are updated, not skipped.

## Risks

- A stop-level conflict marker is not in this change; a conflict introduced by an edit appears in the
  timeline status, not on the stop, until a follow-up.
- Routes checked by the preview are no longer shown in a panel; they still reach the map.
