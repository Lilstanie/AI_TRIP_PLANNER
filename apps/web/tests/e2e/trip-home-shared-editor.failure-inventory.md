# Shared Trip editor failure inventory

Public seam: fixture-backed browser navigation and visible editor controls.

- Home Itinerary renders the read-only itinerary instead of the same editable Trip view.
- The conversation top-right Trip view and home Itinerary disagree about the current Plan.
- The drawer is empty while a non-active home trip is being previewed.
- Either entry omits activities, flights, stays, or other fixed itinerary rows.
- A day with only a flight or stay is labelled "Free day".
- A time or place change made through one entry is absent from the other entry.
- A place change made through one entry leaves the home map on the previous marker.
- Moving a stop into Ideas through one entry does not update the other entry.
- Scheduling an Idea from home Ideas does not update the shared editor and map.
- Reversing a prior move does not update both entries and the map.
- Undo from one entry does not update the other entry and map.
- Closing an entry while its preview is pending aborts the edit or leaves the other entry permanently busy.
- A pending edit is applied after the user switches to another trip.
- A refused preview reports success, clears the Undo state, or leaves a changed map.
- A stale preview overwrites a newer Plan.
- Two successful edits followed by one Undo erase the first successful edit.
- Undo overwrites a newer Plan or background route update.
- An older linked Chat snapshot replaces a newer trip snapshot after an edit.
- Switching entries loses the selected day or associates the selected stop with another activity.
- Changing trips leaks Undo, pending state, or selected activity into the next trip.
- Desktop or phone dialog clips controls, traps focus, or overflows horizontally.
- Unsaved time, place details or day title silently disappear when switching editor entries before Save; Cancel must discard the draft without a preview request.
- Direct action switching requires focusing a covered action card instead of using a visible control in the open drawer.
