# Failure inventory: check entry point, case 4

Baseline: `origin/main` `25ce9fa`. Case 4 ("a change whose plan moved on") fails: the stale change is not applied to the other trip, but no `.timeline-status--error` notice appears at all.

- Cause: a held time change is cancelled when the timeline editor unmounts (`useTimelineEdits`' unmount cleanup aborts the request). Opening another trip unmounts the editor, so the stale result is never reported. The "Try the change again" notice (`PLAN_CHANGED`) is only reached when the editor stays mounted.
- Open question: whether a dropped held change should show a notice. Asked Joey (decision card). Until answered, this change asserts the current behaviour: not applied, no error on the other trip.
- Would hide a regression: applying the stale change to the other trip still fails the case; an error leaking onto the other trip still fails it.
