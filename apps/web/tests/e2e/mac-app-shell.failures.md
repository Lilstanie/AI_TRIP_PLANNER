# macOS app shell failure modes

Written before the Mac layer (2026-11-04), for the desktop workspace at 1440 × 900 with the
`TripPlannerMacApp` user agent.

- The page is not marked as the Mac app, or is marked only after hydration, so the first frame paints
  the web scrollbars and cursors.
- Safari on a Mac, the PWA or the iOS app is marked as the Mac app and loses the web behaviour.
- Sidebar items, top-bar buttons, tabs and the composer's send button still show the pointing hand
  instead of the arrow.
- Links lose the pointing hand along with the buttons.
- Button and tab labels are selected by a double-click or a drag across the sidebar.
- Chat replies and itinerary text can no longer be selected and copied.
- Text fields cannot be typed into because they inherit `user-select: none`.
- The chat stream and panels keep the 10 px web scrollbar instead of the system overlay scrollbar.
- Scrolling past the end rubber-bands the whole window, top bar and sidebar included.
- In dark mode the page background is not the dark page colour, so the native title bar tint (taken
  from the page background) does not match.
