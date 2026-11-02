# Agent Note: follow-up chat turns stop asking to replace edits and stop hiding applied changes

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A live test on the deployed site (Perth to Bali, 7 days, 2 people, AUD 5,000, then follow-ups)
showed two faults on every follow-up message.

1. The browser opened a "Replace your edited plan?" confirm although the traveller had edited
   nothing. Automatic saves (matched stop places, rechecked legs) raise `editVersion`, and
   `confirmReplacingEditedPlan` compared the plan with the snapshot taken at `editVersion` 0, so
   every automatic save looked like a traveller edit. After a reload or a trip switch there was no
   snapshot at all, and any plan with `editVersion > 0` asked.
2. The reply said "I can't verify that requested change from the resulting itinerary." although the
   recorded stream showed the planner had read the earlier turns and applied the change (day 3 went
   from two stops to one). `requestedPlanChangeApplied` only recognises move, add and remove
   phrasings and brief facts; for any other request ("fewer activities on day 3", or the question
   "What did I just ask you to change?") it returned false, so `groundedReply` replaced the model's
   correct answer. To the traveller this looked like the chat had no memory.

## Decision

- The trip editor passes the base plan of a background apply to `session.applyEdit`; the transport's
  `settleBackground` moves its unedited snapshot forward when that base was itself unedited. A
  traveller edit still leaves the plan different from the snapshot, so the confirm still appears
  after a real edit, as `2026-10-28-quiet-panel-walkthrough.md` requires.
- The snapshot carries its trip id. With no snapshot for the plan's trip (after a reload or a trip
  switch) the transport does not ask; undo steps are cleared on reload as well, so edits made before
  a reload are no longer distinguishable from the plan the traveller kept.
- When the plan materially changed and the request is not a move, add or remove phrasing the guard
  can check, the change claim stands. An unchanged plan, a parsed move/add/remove that did not
  happen, and booking claims are still replaced.
- Follow-up (TP-258): background saves are held while a chat turn writes the trip
  (`useWorkspaceTripEditor` `held: editPending || chatWriting`). The production re-test after the
  first fix showed the turn-1 plan's automatic saves landing while turn 2 ran; `finish` saw a
  different `editVersion`, treated it as a traveller edit (`planConflict`), kept the auto-saved
  turn-1 plan and dropped the chat result, so turn 3 still saw the stop turn 2 removed.
- Follow-up (TP-259): an information question (English what/which/when/where/who/why/how
  much|many|long|far|often ending in "?", not "what if"; Chinese 什么/哪/多少/几 ending in a question
  mark) skips the change-claim check. The re-test after TP-258 showed "What did I just ask you to
  change?" answered with a recap of turn 2's change while this turn's plan was unchanged, and the
  recap was replaced. Booking claims are still checked; 吗 questions are left out because they are
  often change requests (能把…删掉吗？).

- Follow-up (TP-262): an unsupported claim is no longer replaced outright. `ungroundedClaim` names the
  fact that contradicts the reply (plan unchanged, requested change missing, nothing booked) and
  `truthfulReply` asks the model once to rewrite the reply given that fact. The fixed sentence is the
  fallback when the model fails or its rewrite still makes the claim. After an unchanged replan the
  model's own reply is kept unless it claims a change. The cost sentence stays code-written
  (`2026-10-24-code-cost-sentence.md`).

## Alternatives considered

**Remove the confirm.** The itinerary walkthrough decision keeps it for real edits; only the false
positives were wrong.

**Compare snapshots without place ids and locations.** Automatic saves also retime stops and change
legs, so the excluded fields would keep growing; the revision owner already knows which applies are
background ones.

**Rely on server short-term memory alone.** It is per process unless KV is configured
(`2026-11-01-durable-chat-turns.md`), and the deployment has no KV, so a cold or different instance
lost the conversation; TP-260 sends the visible conversation as a fallback.

**Keep the fixed sentences as the only correction.** Joey asked on 2026-11-02 why replies were fixed
text; the guard's regexes misfire, and a fixed sentence also discards the true parts of the reply.

## Consequences

- An unsupported claim costs one extra model call.

- A plan restored after a reload with edits made before the reload is replaced by a later chat
  replan without asking.
- A reply can claim a change that differs from the one requested when the plan changed for another
  reason and the request is not a parsed move, add or remove.
