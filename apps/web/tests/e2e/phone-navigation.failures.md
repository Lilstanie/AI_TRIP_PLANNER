# Phone navigation failure inventory

- A saved plan exposes five primary tabs, or an empty workspace exposes Trip.
- Adding a plan changes the current primary view.
- Team opens only the specialist roster instead of the trajectory ledger.
- Ledger filtering, search, or record inspection becomes unreachable.
- Closing or Browser Back loses the originating Chat, Map, Trip, or Mine view.
- Focus escapes the trajectory or does not return to the team trigger.
- Mine places creation actions away from their respective collections.
- Search hides saved trips incorrectly or hides the settings/account entry.
- English or Chinese content causes page overflow at 360, 375, 390, or 520 px.
- Resizing to 521 px or desktop leaves phone navigation or an open phone modal.

Repeatable evidence: `pnpm --filter @trip/web e2e phone-navigation`, plus the
trajectory and Mine journeys. Screenshots and JSON are under
`output/playwright/phone-navigation/`.
