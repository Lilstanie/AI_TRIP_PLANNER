# Trip home action panels failure inventory

Public seam: fixture-backed browser Trip home action panels.

The journey must fail when any of these outcomes regress:

1. Opening one action leaves no clickable or Tab-reachable control that switches to another action without closing first.
2. The only switch proof focuses a covered rail card programmatically instead of using an in-panel control.
3. Expanding fails to place panel content and the Trip map side by side on desktop.
4. Collapsing fails to restore the narrow right panel while keeping the same Trip, Chat, selected day and edit state.
5. Closing, Escape or outside press drops the selected day, open Chat, pending edit or scroll position, or fails to restore focus to the opening control.
6. Phone panels stop filling the screen, lose the existing phone navigation, or let Escape/Back close Settings or a nested editor in the wrong order.
7. Non-AUD Bookings prices omit the established estimate/exchange-rate notice.
8. Schedule accessible names or the Flights heading bypass the translation catalogue in English or Chinese.
9. Zoom, a narrow content container, an extreme chat/map split or a responsive breakpoint clips the panel, traps focus or creates horizontal overflow.
10. Browser console or page errors occur during the journey.

The repeatable evidence is `trip-home-action-panels.e2e.mjs`. It seeds local fixture data and writes screenshots plus `summary.json` under `output/playwright/trip-home-action-panels/`. Fixture and browser results do not establish live-provider or physical-device behaviour.
