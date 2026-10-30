# Offline follow-up failure inventory

Written before the offline no-change follow-up fix (TP-181).

- A follow-up with nothing the offline extractor can read reruns all five specialists, so the
  traveller waits for a full replan and the Think row shows five subagents for no change.
- The reply claims "I rechecked the itinerary" and asks what to change, which reads as if the
  request was understood; the traveller repeats it and gets the same reply.
- The reply follows the interface language instead of the message language.
- A follow-up that does carry a brief change (travellers, dates, budget) stops replanning.
- The unchanged plan is returned with a new identity or edit version, so the web shows a conflict.
- A follow-up that names a day (第三天, day 3) is read as a new trip length and shortens the trip.
- "Make it 3 days" only changes the brief inside the intake, so a check on the extracted patch alone
  would skip a real change.
- A blank conversation (no plan yet) is affected instead of only follow-ups.

Evidence: chat tests cover each item; `offline-follow-up.e2e.mjs` records reply text, specialist count
and latency before and after.
