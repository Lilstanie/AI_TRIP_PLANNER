# Chat header failure inventory

Public seam: browser navigation, Chat header controls and persisted workspace after reload.
This continues the approved browser E2E seam for the Mindtrip implementation.

- Chat title is confused with Trip title, or an ordinary Chat requires a Trip.
- Switch chat counts the current Chat or opens a Chat from another Trip.
- New chat in the switcher loses its Trip association before the first send.
- View trip fails to reach Trip home; returning to a Chat embeds it inside Trip home.
- Moving a Chat loses its messages, duplicates membership, overwrites either itinerary, or
  returns to the old Trip after an autosave/reload.
- Removing a Chat deletes the Trip or restores its old association on autosave/reload.
- Moving a generating Chat transfers the response or cancels it without an explicit Stop.
- New trip loses the current Chat instead of keeping it attached to the new plan.
- Rename or delete acts on a stale Chat after switching.
- Rename opens without the current title focused and selected, saves a blank name, or Escape and
  Cancel change the name or lose focus.
- Delete does not name its target, or Cancel removes the Chat.
- Trajectory is unreachable from the sidebar, lacks a return to Conversation, or breaks phone access.
- Menu keyboard navigation, Escape, focus restoration, touch, translation or narrow layout fails.
- Long Chat/Trip titles hide facts, the Trip action or composer; the page scrolls sideways.

Fixture runs isolate credentials and intercept external requests. They do not establish live
provider behavior or physical keyboard/device behavior.

- The only Chat in a Trip shows a switch menu with nothing to switch to, or loses its Trip name.

- Chat entry from Trajectory must show Conversation: Trip-linked entry, header New chat and global
  New chat after phone-to-desktop resize. These checks replace the separate navigation audit matrix.
