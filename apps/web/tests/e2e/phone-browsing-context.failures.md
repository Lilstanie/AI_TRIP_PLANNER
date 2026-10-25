# Shared Trip browsing context failure inventory

Verification seam: the real workspace UI with persisted fixture Trips and fixture HTTP providers.

- Map day changes do not reach Trip, or Trip day changes do not reach Map.
- Selecting a repeated place chooses its first visit instead of the exact Stop on its later day.
- Switching tabs, crossing 520/521 px or widening to desktop resets day, Stop or mounted views.
- A revision clears a still-valid Stop, retains a removed Stop, or leaves a removed day selected.
- An empty remaining day jumps to another day instead of retaining its calendar position.
- Mine opens saved Trips in Chat, mixes context between two Trips, or fails to restore on reopening.
- Recent chats fail to open Chat; a new Trip inherits another Trip's context.
- Reload loses saved context; unavailable local storage prevents browsing.

Evidence: phone-browsing-context.e2e.mjs writes timestamped screenshots and a summary of assertions,
viewport and language. Fixture provider responses exercise the normal HTTP/session path. Existing
on-trip-day E2E protects destination-local today behavior. No live provider or physical keyboard claim.
