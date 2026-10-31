# Trip home action panels failure inventory

Public seam: fixture-backed browser Trip home action panels.

The journey must fail when any of these outcomes regress:

1. Opening one action leaves no clickable or Tab-reachable control that switches to another action without closing first.
2. The only switch proof focuses a covered rail card programmatically instead of using an in-panel control.
3. The open panel fails to sit beside the Trip map on desktop.
4. Opening or switching panels unmounts the Trip map host or its renderer.
5. Closing, Escape or outside press drops the selected day, open Chat, pending edit or scroll position, or fails to restore focus to the opening control.
6. Phone panels stop filling the screen, lose the existing phone navigation, or let Back/Escape close Settings or a nested editor in the wrong order.
7. Non-AUD Bookings prices omit the established estimate/exchange-rate notice.
8. Schedule accessible names or the Flights heading bypass the translation catalogue in English or Chinese.
9. Arrow-key switching fails to move selection and focus together.
10. Zoom, a narrow content container, a responsive breakpoint clips the panel, traps focus or creates horizontal overflow.
11. Browser console or page errors occur during the journey.
12. Saving Trip preferences after an outside Budget edit restores the older Budget or drops the unsubmitted preference.
13. Google rejects the key while markers are on the map: detaching a marker from the rejected map throws, the failure handler stops halfway, the map stays mounted and nothing replaces it.

The repeatable evidence is `trip-home-action-panels.e2e.mjs`. It seeds local fixture data and writes screenshots plus `summary.json` under `output/playwright/trip-home-action-panels/`. Fixture and browser results do not establish live-provider or physical-device behaviour.
