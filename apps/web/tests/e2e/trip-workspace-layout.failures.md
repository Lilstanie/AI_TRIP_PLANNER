# Trip workspace layout failure inventory

- A saved Trip still opens as a drawer over the chat/map split; its itinerary is not a dedicated workspace.
- Wide Trip review does not keep timeline, map, and selected place details visible together.
- Selecting a Stop/day in one surface does not keep the other surface on the same day and selected identity.
- Tablet Trip review leaves the itinerary/map switch unavailable or switches away from the selected day.
- Phone Trip navigation or its shared day context regresses when returning from Chat or Map.
- Expanded budget or travel tips push the selected day's itinerary below the first screen.
- A constrained header clips or overlaps the Trip title, facts, team control, or primary actions when the sidebar is expanded, labels are long, or zoom reduces usable width.
- The compact team entry has no accessible Agent Team name, hides the working count, or cannot be opened by keyboard while idle/working.
- English/Chinese labels or 520/521 and 1000/1001 transitions break the appropriate responsive mode.

The E2E uses the fixture workspace and checks user-visible roles, current selection/day, layout presence, and geometry. It does not establish live provider behavior or physical-device rendering.
