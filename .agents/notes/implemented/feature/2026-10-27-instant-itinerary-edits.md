# Agent Note: Itinerary edits apply at once

Status: implemented
Owner: spec #743, ticket #744

## Problem

The [Trip redesign](2026-10-26-trip-redesign.md) (#721, #726) made every itinerary form ask before it
let go. A half-filled form was kept as a draft, listed in an "Unfinished trip edits" banner, marked stale
when the plan moved on, and guarded by a "Discard changes?" dialog. Add place showed a Day, Start time and
End time form after a search result was chosen and waited for a second confirm. The traveller asks
permission at every step, which the [immediate timeline edits](2026-10-08-immediate-timeline-edits.md)
decision of 2026-10-08 had already ruled out.

## Decision

- Every itinerary edit the traveller can make applies as a plan revision on submit and offers Undo. No
  itinerary form keeps a draft, shows a banner, asks to discard or marks itself stale. Escape, Cancel,
  outside dismissal and Back close a form and drop what was typed.
- `TripDrafts.tsx`, its provider, the restore entry and the Stop forms' use of `useDiscardChanges` are
  deleted. `useDiscardChanges` stays for the Brief sheets, which are not itinerary edits.
- Adding a place puts the stop on the viewed day, or in Ideas, at once; there is no preview, Day or time
  field. The Add place form of this note became the [Add to trip panel](2026-10-27-add-to-trip-panel.md).
- A day-only `add` operation of `/api/trip/preview-edit` is timed by the server: a one-hour stop after
  the day's last stop, no earlier than that stop's travel plus 15 minutes, 09:00 on an empty day, refused
  with the beyond-the-day notice when the day has no room. The client cannot know the travel time, so a
  guessed slot would be refused by the server's own leg check on ordinary adds. Adds with explicit times
  and Ideas behave as before; a start or end time without the other is rejected.
- Editors that open as sheets, popovers or full pages stay for now. A trip locked by a running assistant
  still disables edits, drags and Add place.

This supersedes the draft protection, discard confirmation and Add place preview parts of the Trip
redesign note and Q12 of the mobile workspace design for the itinerary; the rest of both stands.

## Alternatives considered

- Keep the Day and time fields on Add place but prefill them: it still waits for a confirm and keeps the
  preview step the traveller asked to lose.
- Let the client suggest the slot and retry after a refusal: a retry would hide that the client guessed
  without the travel time.

## Consequences

- A wrong add or edit costs one Undo, not a dialog; an abandoned form is simply gone.
- A traveller cannot choose a time while adding; the time is changed afterwards from the stop.
- The `trip-drafts` E2E and the draft and orphan scenarios of `trip-review-recovery` are removed with the
  feature; `instant-edits` covers each edit kind, Undo and the locked trip.

## Sources

- [Spec #743](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/743), ticket #744.
